import { useEffect, useRef } from 'react'

/** Accessible modal built on the native <dialog>. Children only mount while open, so forms reset every time. */
export default function Modal({ open, onClose, locked = false, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => locked && e.preventDefault()}
      onClick={(e) => !locked && e.target === ref.current && onClose()}
    >
      {open && children}
    </dialog>
  )
}
