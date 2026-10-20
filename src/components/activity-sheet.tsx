"use client";

import Sheet from "./sheet";
import { useAppData } from "@/lib/store";
import { ago, eventText } from "@/lib/activity-text";

export default function ActivitySheet({
  since,
  onClose,
}: {
  since: number;
  onClose: () => void;
}) {
  const { activity, nameOf, isMe } = useAppData();
  const sorted = [...activity].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <Sheet title="Activity" onClose={onClose}>
      {sorted.length === 0 ? (
        <p className="lede">
          Nothing yet. When either of you picks something up or finishes it, it shows here.
        </p>
      ) : (
        <ul className="feed">
          {sorted.map((a) => {
            const ts = new Date(a.created_at).getTime();
            const fresh = !!a.by && !isMe(a.by) && ts > since;
            return (
              <li key={a.id} className={fresh ? "fresh" : ""}>
                <span className="dot" />
                <div>
                  <div>{eventText(a, nameOf, isMe)}</div>
                  <span className="sub">{ago(ts)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="hint">
        While this page is open you also get a pop-up when the other person does something.
      </p>
    </Sheet>
  );
}
