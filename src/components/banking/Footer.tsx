// Customer-facing footer.
'use client'

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} AegisBank</span>
        <nav className="flex items-center gap-4" aria-label="Footer">
          <a href="#terms" className="transition hover:text-foreground">Terms</a>
          <a href="#privacy" className="transition hover:text-foreground">Privacy</a>
          <a href="#help" className="transition hover:text-foreground">Help</a>
        </nav>
      </div>
    </footer>
  )
}
