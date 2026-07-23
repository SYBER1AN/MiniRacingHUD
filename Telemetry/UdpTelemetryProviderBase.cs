using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;

namespace MiniRacingHUD.Telemetry;

public abstract class UdpTelemetryProviderBase : ITelemetryProvider
{
    public abstract string GameName { get; }
    public abstract IReadOnlyList<(string key, string label)> Fields { get; }

    public bool IsConnected { get; protected set; }

    protected abstract int Port { get; }

    protected readonly object _bufferLock = new();
    protected byte[]? _lastBuffer;
    protected DateTime _lastPacketTime = DateTime.MinValue;

    private UdpClient? _client;
    private CancellationTokenSource? _cts;
    private Task? _receiveTask;
    private bool _disposed;

    public virtual bool Connect()
    {
        DisposeProvider();
        _cts = new CancellationTokenSource();
        _client = new UdpClient(Port);
        _receiveTask = ReceiveLoopAsync(_cts.Token);
        IsConnected = true;
        return true;
    }

    public virtual void Disconnect()
    {
        DisposeProvider();
        IsConnected = false;
    }

    private void DisposeProvider()
    {
        _cts?.Cancel();
        _cts?.Dispose();
        _cts = null;

        _client?.Dispose();
        _client = null;

        lock (_bufferLock)
        {
            _lastBuffer = null;
            _lastPacketTime = DateTime.MinValue;
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        Disconnect();
    }

    private async Task ReceiveLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var result = await _client!.ReceiveAsync(ct);
                ProcessPacket(result.Buffer);
            }
            catch (OperationCanceledException) { break; }
            catch (ObjectDisposedException) { break; }
            catch (Exception)
            {
                try { await Task.Delay(100, ct); }
                catch (OperationCanceledException) { break; }
            }
        }
    }

    protected virtual void ProcessPacket(byte[] buffer)
    {
        if (!FilterPacket(buffer)) return;
        lock (_bufferLock)
        {
            _lastBuffer = buffer;
            _lastPacketTime = DateTime.UtcNow;
        }
    }

    protected abstract bool FilterPacket(byte[] buffer);

    protected abstract Dictionary<string, object> ParseFull(byte[] buffer);
    protected abstract Dictionary<string, object> ParseReduced(byte[] buffer);

    public Dictionary<string, object>? ReadTelemetry()
    {
        lock (_bufferLock)
        {
            if (_lastBuffer == null) return null;
            if ((DateTime.UtcNow - _lastPacketTime).TotalSeconds > 3)
            {
                _lastBuffer = null;
                _lastPacketTime = DateTime.MinValue;
                return null;
            }
            return ParseFull(_lastBuffer);
        }
    }

    public Dictionary<string, object>? ReadReduced()
    {
        lock (_bufferLock)
        {
            if (_lastBuffer == null) return null;
            if ((DateTime.UtcNow - _lastPacketTime).TotalSeconds > 3)
            {
                _lastBuffer = null;
                _lastPacketTime = DateTime.MinValue;
                return null;
            }
            return ParseReduced(_lastBuffer);
        }
    }
}
