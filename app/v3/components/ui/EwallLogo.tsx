interface EwallLogoProps {
  size?: number
  color?: string
}

export function EwallLogo({ size = 28, color = '#fff' }: EwallLogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-label="Ewall">
      <rect x="1" y="1" width="38" height="38" rx="9" stroke={color} strokeOpacity="0.18" strokeWidth="1" />
      <path
        d="M10 26V14h6.5a4 4 0 0 1 0 8H13"
        stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M22 14h8m-4 0v12" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="30" cy="26" r="1.6" fill={color} />
    </svg>
  )
}
