import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface TimeZoneConfig {
  name: string;
  nameZh: string;
  timezone: string;
  offset: string;
  cities: string[];
}

// USA timezones (remove GMT-9) ordered by GMT -8, -7, -6, -5 for column alignment
const usTimeZones: TimeZoneConfig[] = [
  // GMT-8
  {
    name: "Los Angeles",
    nameZh: "洛杉矶",
    timezone: "America/Los_Angeles",
    offset: "GMT-8",
    cities: [
      "Los Angeles",
      "San Francisco",
      "San Diego",
      "Seattle",
      "Portland",
      "Las Vegas",
    ],
  },
  // GMT-7
  {
    name: "Denver",
    nameZh: "丹佛",
    timezone: "America/Denver",
    offset: "GMT-7",
    cities: [
      "Phoenix",
      "Salt Lake City",
      "Boise",
      "Santa Fe",
      "Cheyenne",
      "Helena",
    ],
  },
  // GMT-6
  {
    name: "Chicago",
    nameZh: "芝加哥",
    timezone: "America/Chicago",
    offset: "GMT-6",
    cities: [
      "Dallas",
      "Houston",
      "Chicago",
      "Minneapolis",
      "St. Louis",
      "New Orleans",
    ],
  },
  // GMT-5
  {
    name: "New York",
    nameZh: "纽约",
    timezone: "America/New_York",
    offset: "GMT-5",
    cities: [
      "New York",
      "Philadelphia",
      "Miami",
      "Atlanta",
      "Boston",
      "Washington D.C.",
    ],
  },
];

// Canada timezones
const caTimeZones: TimeZoneConfig[] = [
  {
    name: "Vancouver",
    nameZh: "温哥华",
    timezone: "America/Vancouver",
    offset: "GMT-8",
    cities: ["Surrey", "Burnaby", "Richmond"],
  },
  {
    name: "Edmonton",
    nameZh: "埃德蒙顿",
    timezone: "America/Edmonton",
    offset: "GMT-7",
    cities: ["Calgary", "Red Deer", "Lethbridge"],
  },
  {
    name: "Winnipeg",
    nameZh: "温尼伯",
    timezone: "America/Winnipeg",
    offset: "GMT-6",
    cities: ["Brandon", "Steinbach", "Selkirk"],
  },
  {
    name: "Toronto",
    nameZh: "多伦多",
    timezone: "America/Toronto",
    offset: "GMT-5",
    cities: ["Ottawa", "Mississauga", "Hamilton"],
  },
];

export function WorldClock() {
  const { language, t } = useLanguage();
  const [times, setTimes] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const updateTimes = () => {
      const newTimes = new Map<string, string>();
      const now = new Date();
      [...usTimeZones, ...caTimeZones].forEach((tz) => {
        const timeString = now.toLocaleTimeString('en-US', {
          timeZone: tz.timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        newTimes.set(tz.timezone, timeString);
      });

      setTimes(newTimes);
    };

    // Update immediately
    updateTimes();
    
    // Update every second
    const interval = setInterval(updateTimes, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const renderTime = (timeString: string) => {
    if (!timeString) return "00:00:00";
    
    // Parse hour to check if PM (>= 12)
    const hour = parseInt(timeString.split(':')[0]);
    const isPM = hour >= 12;
    
    if (isPM) {
      // Highlight first digit in blue
      const firstChar = timeString[0];
      const rest = timeString.slice(1);
      return (
        <>
          <span className="text-blue-500">{firstChar}</span>
          {rest}
        </>
      );
    }
    
    return timeString;
  };

  const renderCityName = (name: string) => {
    return name;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          {t('worldClock.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs font-semibold text-muted-foreground">USA</div>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
          {usTimeZones.map((tz) => (
            <div
              key={tz.timezone}
              className="flex flex-col items-center p-2 rounded-md border-2 border-blue-500/30 hover-elevate"
              data-testid={`clock-${tz.timezone}`}
            >
              <div className="text-lg font-bold font-mono tabular-nums" data-testid={`time-${tz.timezone}`}>
                {renderTime(times.get(tz.timezone) || "00:00:00")}
              </div>
              <div className="text-xs text-muted-foreground mt-1 text-center" style={{ color: 'inherit' }}>
                {renderCityName(language === 'zh' ? tz.nameZh : tz.name)}
              </div>
              <div className="text-xs text-muted-foreground/60">
                {tz.offset}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] leading-4 text-muted-foreground text-center" data-testid={`cities-${tz.timezone}`}>
                {tz.cities.slice(0, 6).map((c) => (
                  <span key={c} className="whitespace-normal break-words">{c}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs font-semibold text-muted-foreground">Canada</div>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
          {caTimeZones.map((tz) => (
            <div key={tz.timezone} className="flex flex-col items-center p-2 rounded-md border-2 border-blue-500/30 hover-elevate">
              <div className="text-lg font-bold font-mono tabular-nums">{renderTime(times.get(tz.timezone) || '00:00:00')}</div>
              <div className="text-xs text-muted-foreground mt-1 text-center" style={{ color: 'inherit' }}>{renderCityName(language === 'zh' ? tz.nameZh : tz.name)}</div>
              <div className="text-xs text-muted-foreground/60">{tz.offset}</div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] leading-4 text-muted-foreground text-center">
                {tz.cities.slice(0, 3).map((c) => (<span key={c} className="whitespace-normal break-words">{c}</span>))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 mb-2 text-xs font-bold text-center">
          {t('worldClock.disclaimer')}
        </div>
      </CardContent>
    </Card>
  );
}
