export type IconName =
  | 'grid' | 'truck' | 'file' | 'receipt' | 'map' | 'chart'
  | 'users' | 'settings' | 'bell' | 'search' | 'plus'
  | 'chevDown' | 'chevRight' | 'chevLeft' | 'download' | 'filter'
  | 'arrow' | 'arrowUp' | 'arrowDown' | 'check' | 'clock'
  | 'shield' | 'fuel' | 'upload' | 'sparkle' | 'pin' | 'more'

interface V3IconProps {
  name: IconName
  size?: number
  stroke?: number
  className?: string
}

const PATHS: Record<IconName, React.ReactNode> = {
  grid:      <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  truck:     <><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></>,
  file:      <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></>,
  receipt:   <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  map:       <><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v16M15 6v16"/></>,
  chart:     <><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></>,
  users:     <><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3.1-6 7-6s7 2.5 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M22 19c0-2.5-2-4.5-5-4.5"/></>,
  settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c0 .7.4 1.3 1 1.6"/></>,
  bell:      <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
  search:    <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  plus:      <><path d="M12 5v14M5 12h14"/></>,
  chevDown:  <><path d="m6 9 6 6 6-6"/></>,
  chevRight: <><path d="m9 6 6 6-6 6"/></>,
  chevLeft:  <><path d="m15 18-6-6 6-6"/></>,
  download:  <><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></>,
  filter:    <><path d="M3 5h18"/><path d="M6 12h12"/><path d="M10 19h4"/></>,
  arrow:     <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  arrowUp:   <><path d="m6 15 6-6 6 6"/></>,
  arrowDown: <><path d="m6 9 6 6 6-6"/></>,
  check:     <><path d="m5 12 5 5L20 7"/></>,
  clock:     <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  shield:    <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/></>,
  fuel:      <><path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16"/><path d="M3 21h13"/><path d="M6 9h7"/><path d="M15 8h2l3 3v7a2 2 0 0 1-4 0v-3h-1"/></>,
  upload:    <><path d="M12 20V8"/><path d="m7 13 5-5 5 5"/><path d="M5 4h14"/></>,
  sparkle:   <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></>,
  pin:       <><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></>,
  more:      <><circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/></>,
}

export function V3Icon({ name, size = 16, stroke = 1.6, className }: V3IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  )
}
