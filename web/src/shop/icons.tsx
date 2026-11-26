import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);

export const CartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 4h2.2l2.1 10.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.2L21 7.5H6" />
    <circle cx="9.5" cy="19.5" r="1.3" />
    <circle cx="17" cy="19.5" r="1.3" />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.5 20c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4" />
  </Svg>
);

export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7-4.4-8.6-9A4.6 4.6 0 0 1 12 7.2 4.6 4.6 0 0 1 20.6 11C19 15.6 12 20 12 20Z" />
  </Svg>
);

export const EyeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 7h15M9.5 7V4.8h5V7M7 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h5.2a1.5 1.5 0 0 0 1.5-1.3L17 7" />
  </Svg>
);

export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
  </Svg>
);

export const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <circle cx="5" cy="6.5" r="1" />
    <circle cx="5" cy="12" r="1" />
    <circle cx="5" cy="17.5" r="1" />
  </Svg>
);

export const FilterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Svg>
);

export const TruckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7" />
    <circle cx="6.5" cy="17.5" r="1.6" />
    <circle cx="17" cy="17.5" r="1.6" />
  </Svg>
);

export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 19 6v5.5c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Svg>
);

export const GiftIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="9" width="17" height="11" rx="1" />
    <path d="M2.5 9h19V6.5h-19zM12 6.5V20" />
    <path d="M12 6.5C10 3 7 3.5 7.3 5.3 7.6 6.5 12 6.5 12 6.5Zm0 0c2-3.5 5-3 4.7-1.2-.3 1.2-4.7 1.2-4.7 1.2Z" />
  </Svg>
);

export const RockingHorseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 19c4 2 12 2 16 0" />
    <path d="M7 18.5 8.5 13h7l1.5 5.5" />
    <path d="M8.5 13c-.8-2.2.2-4.3 2.4-5l1.6-3.5 1.2 2 2.8.5-.6 2.2-1.9.3L15.5 13" />
  </Svg>
);

export const CakeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20.5h16M5.5 20.5v-7h13v7M5.5 15.5c1.6 1.2 3 1.2 4.3 0 1.4 1.2 2.9 1.2 4.4 0 1.4 1.2 2.9 1.2 4.3 0" />
    <path d="M12 13.5V10M12 7.8c-.9-.8-.4-2.3 0-3 .4.7.9 2.2 0 3Z" />
  </Svg>
);

export const EnvelopeIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="1.2" />
    <path d="m3.5 6.5 8.5 7 8.5-7" />
  </Svg>
);
