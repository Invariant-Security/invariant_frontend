// Small inline SVG icons -- stand-ins for the ~10 lucide-react icons the
// original design used. Keeps this project dependency-free (still just
// react/react-dom) instead of pulling in a whole icon package for a
// handful of glyphs.

function Icon({ size = 20, children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function ArrowDownRight(props) {
  return (
    <Icon {...props}>
      <path d="M7 7l10 10M17 7v10H7" />
    </Icon>
  )
}

export function ArrowUpRight(props) {
  return (
    <Icon {...props}>
      <path d="M7 17L17 7M7 7h10v10" />
    </Icon>
  )
}

export function CheckCircle2(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.3 2.3L16 10" />
    </Icon>
  )
}

export function ChevronRight(props) {
  return (
    <Icon {...props}>
      <path d="M9 6l6 6-6 6" />
    </Icon>
  )
}

export function CircleAlert(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <circle cx="12" cy="16.2" r="0.6" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function ExternalLink(props) {
  return (
    <Icon {...props}>
      <path d="M9 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-3" />
      <path d="M14 4h6v6" />
      <path d="M20 4L10 14" />
    </Icon>
  )
}

export function FileCheck2(props) {
  return (
    <Icon {...props}>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 15l2 2 4-4" />
    </Icon>
  )
}

export function Layers3(props) {
  return (
    <Icon {...props}>
      <path d="M12 3l8 4-8 4-8-4 8-4z" />
      <path d="M4 13l8 4 8-4" />
      <path d="M4 17l8 4 8-4" />
    </Icon>
  )
}

export function Menu(props) {
  return (
    <Icon {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Icon>
  )
}

export function ScanSearch(props) {
  return (
    <Icon {...props}>
      <path d="M4 8V6a2 2 0 012-2h2" />
      <path d="M4 16v2a2 2 0 002 2h2" />
      <path d="M20 8V6a2 2 0 00-2-2h-2" />
      <path d="M20 16v2a2 2 0 01-2 2h-2" />
      <circle cx="11" cy="11" r="4" />
      <path d="M14.2 14.2L17 17" />
    </Icon>
  )
}

export function X(props) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  )
}
