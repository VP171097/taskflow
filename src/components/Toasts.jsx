import { createContext, useCallback, useContext, useState } from 'react'

const Ctx = createContext(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const toast = useCallback((msg, action) => {
    const id = Math.random()
    setItems((p) => [...p, { id, msg, action }])
    setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), action ? 6000 : 3400)
  }, [])
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div className="toast" key={t.id}>
            <span>{t.msg}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action.fn()
                  setItems((p) => p.filter((x) => x.id !== t.id))
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
