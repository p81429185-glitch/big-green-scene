import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Play, Users, TrendingUp, Calendar } from "lucide-react";

interface VideoAnalyticsTabProps {
  videoId: string;
  video: {
    plays: number;
    created_at: string;
    size: number;
  };
}

interface AnalyticsData {
  totalViews: number;
  uniqueViewers: number;
  avgEngagement: number;
}

const VideoAnalyticsTab = ({ videoId, video }: VideoAnalyticsTabProps) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: views, error } = await supabase
        .from("video_views")
        .select("viewer_session, watch_duration_seconds, video_duration_seconds")
        .eq("video_id", videoId);

      if (error || !views) {
        setData({ totalViews: video.plays, uniqueViewers: 0, avgEngagement: 0 });
        setLoading(false);
        return;
      }

      const uniqueSessions = new Set(views.map((v) => v.viewer_session)).size;
      const avgEng = views.length > 0
        ? views.reduce((acc, v) => {
            const dur = v.video_duration_seconds || 1;
            return acc + (v.watch_duration_seconds / dur) * 100;
          }, 0) / views.length
        : 0;

      setData({
        totalViews: Math.max(video.plays, views.length),
        uniqueViewers: uniqueSessions,
        avgEngagement: Math.min(100, Math.round(avgEng)),
      });
      setLoading(false);
    };
    load();
  }, [videoId, video.plays]);

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Ładowanie analityki...</div>;
  }

  const stats = [
    { icon: Play, label: "Odtworzenia", value: data?.totalViews ?? 0 },
    { icon: Users, label: "Unikalni widzowie", value: data?.uniqueViewers ?? 0 },
    { icon: TrendingUp, label: "Śr. engagement", value: `${data?.avgEngagement ?? 0}%` },
    { icon: Calendar, label: "Dodano", value: new Date(video.created_at).toLocaleDateString("pl-PL") },
  ];

  return (
    <div className="py-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ icon: Icon, label, value }) => (
          <Card key={label} className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span className="text-xs">{label}</span>
            </div>
            <p className="text-xl font-bold">{value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default VideoAnalyticsTab;
