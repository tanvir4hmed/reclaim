/** Child's drawing: crayon scrawls across the screen. A stick family, and you, drawn last, in red. */
export function ChildDrawing() {
  return (
    <div className="ts-full ts-paper">
      <svg className="ts-crayon" viewBox="0 0 800 400">
        {[0, 1, 2].map((i) => (
          <g key={i} className="ts-stick" style={{ animationDelay: `${i * 0.35}s` }} transform={`translate(${160 + i * 130} 120)`}>
            <circle cx="0" cy="0" r="22" />
            <path d="M0 22 L0 120 M0 50 L-36 86 M0 50 L36 86 M0 120 L-26 190 M0 120 L26 190" />
          </g>
        ))}
        <g className="ts-stick ts-stick-you" style={{ animationDelay: '1.3s' }} transform="translate(620 120)">
          <circle cx="0" cy="0" r="22" />
          <path d="M0 22 L0 120 M0 50 L-36 86 M0 50 L36 86 M0 120 L-26 190 M0 120 L26 190" />
          <path d="M-10 -4 l20 8 M10 -4 l-20 8" />
        </g>
        <text className="ts-crayon-text" x="420" y="370" textAnchor="middle">
          THIS IS YOU
        </text>
      </svg>
    </div>
  );
}
