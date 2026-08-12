import { statusStyle } from "@/lib/format";
import type { Status } from "@/lib/types";

/**
 * The rubber stamp on the verdict. Curved text on a circular path, ink-bled
 * edges, rotated a few degrees off true -- a certificate, not a status badge.
 */
export function StatusStamp({
  status,
  urgency,
  size = 168,
}: {
  status: Status;
  urgency?: number;
  size?: number;
}) {
  const style = statusStyle(status);
  const id = `stamp-${status || "none"}`;
  const label = status === "" ? "UNHEARD" : status;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className="stamp shrink-0"
      role="img"
      aria-label={`Verdict: ${style.label}`}
    >
      <defs>
        <path
          id={`${id}-arc-top`}
          d="M 100,100 m -74,0 a 74,74 0 1,1 148,0"
          fill="none"
        />
        <path
          id={`${id}-arc-bottom`}
          d="M 100,100 m -62,0 a 62,62 0 1,0 124,0"
          fill="none"
        />
      </defs>

      <circle
        cx="100"
        cy="100"
        r="90"
        fill="none"
        stroke={style.color}
        strokeWidth="3.5"
        opacity="0.85"
      />
      <circle
        cx="100"
        cy="100"
        r="82"
        fill="none"
        stroke={style.color}
        strokeWidth="1.2"
        opacity="0.6"
      />

      <text
        fill={style.color}
        fontSize="11.5"
        letterSpacing="3.4"
        fontFamily="var(--font-mono)"
        opacity="0.9"
      >
        <textPath href={`#${id}-arc-top`} startOffset="50%" textAnchor="middle">
          BUSFACTOR · DORMANCY COURT
        </textPath>
      </text>

      <text
        fill={style.color}
        fontSize="10"
        letterSpacing="3"
        fontFamily="var(--font-mono)"
        opacity="0.75"
      >
        <textPath href={`#${id}-arc-bottom`} startOffset="50%" textAnchor="middle">
          {typeof urgency === "number" ? `URGENCY ${urgency} / 100` : "GENLAYER BRADBURY"}
        </textPath>
      </text>

      <line
        x1="42"
        y1="78"
        x2="158"
        y2="78"
        stroke={style.color}
        strokeWidth="1.2"
        opacity="0.55"
      />
      <line
        x1="42"
        y1="122"
        x2="158"
        y2="122"
        stroke={style.color}
        strokeWidth="1.2"
        opacity="0.55"
      />

      <text
        x="100"
        y="108"
        textAnchor="middle"
        fill={style.color}
        fontSize={label.length > 7 ? "23" : "27"}
        letterSpacing="1.5"
        fontFamily="var(--font-mono)"
        fontWeight="700"
      >
        {label}
      </text>
    </svg>
  );
}
