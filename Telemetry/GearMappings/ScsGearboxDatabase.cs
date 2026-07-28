using System.Collections.Generic;

namespace MiniRacingHUD.Telemetry.GearMappings;

public static class ScsGearboxDatabase
{
    public static List<GearboxMapping> DetectAll(int selectorCount, int gearsForward, string brandHint = "")
    {
        var result = new List<GearboxMapping>(2);
        var brand = brandHint.ToLowerInvariant();

        if (selectorCount == 1 && gearsForward is 10 or 13)
            result.Add(Eaton10Speed);

        if (selectorCount == 2 && gearsForward == 12)
        {
            if (brand.Contains("scania"))
                result.Add(Scania12);
            else if (brand.Contains("volvo") || brand.Contains("renault"))
                result.Add(Volvo12);
            else if (brand.Contains("daf") || brand.Contains("man") || brand.Contains("iveco") || brand.Contains("mercedes"))
                result.Add(Zf12Speed);
            else
            {
                result.Add(Zf12Speed);
                result.Add(Scania12);
                result.Add(Volvo12);
            }
        }

        if (selectorCount == 2 && gearsForward == 13)
            result.Add(Eaton13Speed);

        if (selectorCount == 2 && gearsForward == 14)
        {
            if (brand.Contains("scania"))
                result.Add(Scania12Plus2);
            else if (brand.Contains("volvo") || brand.Contains("renault"))
                result.Add(Volvo12Plus2);
            else if (brand.Contains("daf") || brand.Contains("man") || brand.Contains("iveco") || brand.Contains("mercedes"))
                result.Add(Zf16Speed);
            else
            {
                result.Add(Scania12Plus2);
                result.Add(Volvo12Plus2);
            }
        }

        if (selectorCount == 2 && gearsForward == 16)
            result.Add(Zf16Speed);

        if (selectorCount == 2 && gearsForward >= 18)
            result.Add(Eaton18Speed);

        return result;
    }

    public static GearboxMapping Eaton18Speed { get; } = CreateEaton18Speed();
    public static GearboxMapping Eaton13Speed { get; } = CreateEaton13Speed();
    public static GearboxMapping Eaton10Speed { get; } = CreateEaton10Speed();
    public static GearboxMapping Zf12Speed { get; } = CreateZf12Speed();
    public static GearboxMapping Zf16Speed { get; } = CreateZf16Speed();
    public static GearboxMapping Scania12 { get; } = CreateScania12();
    public static GearboxMapping Scania12Plus2 { get; } = CreateScania12Plus2();
    public static GearboxMapping Volvo12 { get; } = CreateVolvo12();
    public static GearboxMapping Volvo12Plus2 { get; } = CreateVolvo12Plus2();

    private static GearboxMapping CreateEaton18Speed()
    {
        var m = new GearboxMapping
        {
            Name = "Eaton Fuller 18-speed",
            SelectorCount = 2,
            MinForwardGears = 18,
        };

        m.Add(2, false, false, "R1L");
        m.Add(2, false, true,  "R1H");
        m.Add(2, true,  false, "R2L");
        m.Add(2, true,  true,  "R2H");

        m.Add(3, false, false, "LL");
        m.Add(3, false, true,  "LH");

        m.Add(4, false, false, "1L");
        m.Add(4, false, true,  "1H");
        m.Add(4, true,  false, "5L");
        m.Add(4, true,  true,  "5H");

        m.Add(5, false, false, "2L");
        m.Add(5, false, true,  "2H");
        m.Add(5, true,  false, "6L");
        m.Add(5, true,  true,  "6H");

        m.Add(6, false, false, "3L");
        m.Add(6, false, true,  "3H");
        m.Add(6, true,  false, "7L");
        m.Add(6, true,  true,  "7H");

        m.Add(7, false, false, "4L");
        m.Add(7, false, true,  "4H");
        m.Add(7, true,  false, "8L");
        m.Add(7, true,  true,  "8H");

        return m;
    }

    private static GearboxMapping CreateEaton13Speed()
    {
        var m = new GearboxMapping
        {
            Name = "Eaton Fuller 13-speed",
            SelectorCount = 2,
            MinForwardGears = 13,
        };

        m.Add(2, false, false, "RL");
        m.Add(2, false, true,  "RL");
        m.Add(2, true,  false, "RH");
        m.Add(2, true,  true,  "RH");

        m.Add(3, false, false, "L");
        m.Add(3, false, true,  "L");

        m.Add(4, false, false, "1");
        m.Add(4, false, true,  "1");
        m.Add(4, true,  false, "5L");
        m.Add(4, true,  true,  "5H");

        m.Add(5, false, false, "2");
        m.Add(5, false, true,  "2");
        m.Add(5, true,  false, "6L");
        m.Add(5, true,  true,  "6H");

        m.Add(6, false, false, "3");
        m.Add(6, false, true,  "3");
        m.Add(6, true,  false, "7L");
        m.Add(6, true,  true,  "7H");

        m.Add(7, false, false, "4");
        m.Add(7, false, true,  "4");
        m.Add(7, true,  false, "8L");
        m.Add(7, true,  true,  "8H");

        return m;
    }

    private static GearboxMapping CreateEaton10Speed()
    {
        var m = new GearboxMapping
        {
            Name = "Eaton Fuller 10-speed",
            SelectorCount = 1,
            MinForwardGears = 10,
        };

        m.Add(2, false, false, "RL");
        m.Add(2, false, true,  "RL");
        m.Add(2, true,  false, "RH");
        m.Add(2, true,  true,  "RH");

        m.Add(3, false, false, "1");
        m.Add(3, false, true,  "1");
        m.Add(3, true,  false, "6");
        m.Add(3, true,  true,  "6");

        m.Add(4, false, false, "2");
        m.Add(4, false, true,  "2");
        m.Add(4, true,  false, "7");
        m.Add(4, true,  true,  "7");

        m.Add(5, false, false, "3");
        m.Add(5, false, true,  "3");
        m.Add(5, true,  false, "8");
        m.Add(5, true,  true,  "8");

        m.Add(6, false, false, "4");
        m.Add(6, false, true,  "4");
        m.Add(6, true,  false, "9");
        m.Add(6, true,  true,  "9");

        m.Add(7, false, false, "5");
        m.Add(7, false, true,  "5");
        m.Add(7, true,  false, "10");
        m.Add(7, true,  true,  "10");

        return m;
    }

    private static GearboxMapping CreateZf12Speed()
    {
        var m = new GearboxMapping
        {
            Name = "ZF 12-speed",
            SelectorCount = 2,
            MinForwardGears = 12,
        };

        // Slot 3: Reverse (оба диапазона)
        m.Add(3, false, false, "RL");
        m.Add(3, false, true,  "RH");
        m.Add(3, true,  false, "RL");
        m.Add(3, true,  true,  "RH");

        // Slot 4: 1L/1H (Lo), 4L/4H (Hi)
        m.Add(4, false, false, "1L");
        m.Add(4, false, true,  "1H");
        m.Add(4, true,  false, "4L");
        m.Add(4, true,  true,  "4H");

        // Slot 6: 2L/2H (Lo), 5L/5H (Hi)
        m.Add(6, false, false, "2L");
        m.Add(6, false, true,  "2H");
        m.Add(6, true,  false, "5L");
        m.Add(6, true,  true,  "5H");

        // Slot 7: 3L/3H (Lo), 6L/6H (Hi)
        m.Add(7, false, false, "3L");
        m.Add(7, false, true,  "3H");
        m.Add(7, true,  false, "6L");
        m.Add(7, true,  true,  "6H");

        return m;
    }

    private static GearboxMapping CreateZf16Speed()
    {
        var m = new GearboxMapping
        {
            Name = "ZF 16-speed",
            SelectorCount = 2,
            MinForwardGears = 16,
        };

        // Slot 3: Reverse (оба диапазона)
        m.Add(3, false, false, "RL");
        m.Add(3, false, true,  "RH");
        m.Add(3, true,  false, "RL");
        m.Add(3, true,  true,  "RH");

        // Slot 4: 1L/1H (Lo), 5L/5H (Hi)
        m.Add(4, false, false, "1L");
        m.Add(4, false, true,  "1H");
        m.Add(4, true,  false, "5L");
        m.Add(4, true,  true,  "5H");

        // Slot 5: 2L/2H (Lo), 6L/6H (Hi)
        m.Add(5, false, false, "2L");
        m.Add(5, false, true,  "2H");
        m.Add(5, true,  false, "6L");
        m.Add(5, true,  true,  "6H");

        // Slot 6: 3L/3H (Lo), 7L/7H (Hi)
        m.Add(6, false, false, "3L");
        m.Add(6, false, true,  "3H");
        m.Add(6, true,  false, "7L");
        m.Add(6, true,  true,  "7H");

        // Slot 7: 4L/4H (Lo), 8L/8H (Hi)
        m.Add(7, false, false, "4L");
        m.Add(7, false, true,  "4H");
        m.Add(7, true,  false, "8L");
        m.Add(7, true,  true,  "8H");

        return m;
    }

    private static GearboxMapping CreateScania12()
    {
        var m = new GearboxMapping
        {
            Name = "Scania 12-speed",
            SelectorCount = 2,
            MinForwardGears = 12,
        };

        // Slot 2: Reverse (оба диапазона)
        m.Add(2, false, false, "RL");
        m.Add(2, false, true,  "RH");
        m.Add(2, true,  false, "RL");
        m.Add(2, true,  true,  "RH");

        // Slot 5: 1L/1H (Lo), 4L/4H (Hi)
        m.Add(5, false, false, "1L");
        m.Add(5, false, true,  "1H");
        m.Add(5, true,  false, "4L");
        m.Add(5, true,  true,  "4H");

        // Slot 6: 2L/2H (Lo), 5L/5H (Hi)
        m.Add(6, false, false, "2L");
        m.Add(6, false, true,  "2H");
        m.Add(6, true,  false, "5L");
        m.Add(6, true,  true,  "5H");

        // Slot 7: 3L/3H (Lo), 6L/6H (Hi)
        m.Add(7, false, false, "3L");
        m.Add(7, false, true,  "3H");
        m.Add(7, true,  false, "6L");
        m.Add(7, true,  true,  "6H");

        return m;
    }

    private static GearboxMapping CreateScania12Plus2()
    {
        var m = new GearboxMapping
        {
            Name = "Scania 12+2-speed",
            SelectorCount = 2,
            MinForwardGears = 14,
        };

        // Slot 2: Reverse (оба диапазона)
        m.Add(2, false, false, "RL");
        m.Add(2, false, true,  "RH");
        m.Add(2, true,  false, "RL");
        m.Add(2, true,  true,  "RH");

        // Slot 3: Crawlers (только Lo Range)
        m.Add(3, false, false, "C1");
        m.Add(3, false, true,  "C2");

        // Slot 5: 1L/1H (Lo), 4L/4H (Hi)
        m.Add(5, false, false, "1L");
        m.Add(5, false, true,  "1H");
        m.Add(5, true,  false, "4L");
        m.Add(5, true,  true,  "4H");

        // Slot 6: 2L/2H (Lo), 5L/5H (Hi)
        m.Add(6, false, false, "2L");
        m.Add(6, false, true,  "2H");
        m.Add(6, true,  false, "5L");
        m.Add(6, true,  true,  "5H");

        // Slot 7: 3L/3H (Lo), 6L/6H (Hi)
        m.Add(7, false, false, "3L");
        m.Add(7, false, true,  "3H");
        m.Add(7, true,  false, "6L");
        m.Add(7, true,  true,  "6H");

        return m;
    }

    private static GearboxMapping CreateVolvo12()
    {
        var m = new GearboxMapping
        {
            Name = "Volvo 12-speed",
            SelectorCount = 2,
            MinForwardGears = 12,
        };

        // Slot 3: Reverse (оба диапазона)
        m.Add(3, false, false, "RL");
        m.Add(3, false, true,  "RH");
        m.Add(3, true,  false, "RL");
        m.Add(3, true,  true,  "RH");

        // Slot 4: 1L/1H (Lo), 4L/4H (Hi)
        m.Add(4, false, false, "1L");
        m.Add(4, false, true,  "1H");
        m.Add(4, true,  false, "4L");
        m.Add(4, true,  true,  "4H");

        // Slot 5: 2L/2H (Lo), 5L/5H (Hi)
        m.Add(5, false, false, "2L");
        m.Add(5, false, true,  "2H");
        m.Add(5, true,  false, "5L");
        m.Add(5, true,  true,  "5H");

        // Slot 6: 3L/3H (Lo), 6L/6H (Hi)
        m.Add(6, false, false, "3L");
        m.Add(6, false, true,  "3H");
        m.Add(6, true,  false, "6L");
        m.Add(6, true,  true,  "6H");

        return m;
    }

    private static GearboxMapping CreateVolvo12Plus2()
    {
        var m = new GearboxMapping
        {
            Name = "Volvo 12+2-speed",
            SelectorCount = 2,
            MinForwardGears = 14,
        };

        // Slot 2: Crawlers (только Lo Range)
        m.Add(2, false, false, "C1");
        m.Add(2, false, true,  "C2");

        // Slot 3: Reverse — 4 передачи по Range+Split
        m.Add(3, false, false, "RLL");
        m.Add(3, false, true,  "RLH");
        m.Add(3, true,  false, "RHL");
        m.Add(3, true,  true,  "RHH");

        // Slot 4: 1L/1H (Lo), 4L/4H (Hi)
        m.Add(4, false, false, "1L");
        m.Add(4, false, true,  "1H");
        m.Add(4, true,  false, "4L");
        m.Add(4, true,  true,  "4H");

        // Slot 5: 2L/2H (Lo), 5L/5H (Hi)
        m.Add(5, false, false, "2L");
        m.Add(5, false, true,  "2H");
        m.Add(5, true,  false, "5L");
        m.Add(5, true,  true,  "5H");

        // Slot 6: 3L/3H (Lo), 6L/6H (Hi)
        m.Add(6, false, false, "3L");
        m.Add(6, false, true,  "3H");
        m.Add(6, true,  false, "6L");
        m.Add(6, true,  true,  "6H");

        return m;
    }
}
