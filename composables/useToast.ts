import { toast as sonner } from 'vue-sonner'

type ToastKind = 'success' | 'error' | 'warning' | 'info' | 'default'

interface ToastOptions {
  title: string
  description?: string
  duration?: number
  type?: ToastKind
}

export function useToast() {
  const show = ({ title, description, duration, type = 'default' }: ToastOptions) => {
    const options = {
      description,
      duration,
    }

    switch (type) {
      case 'success':
        return sonner.success(title, options)
      case 'error':
        return sonner.error(title, options)
      case 'warning':
        return sonner.warning(title, options)
      case 'info':
        return sonner.info(title, options)
      default:
        return sonner(title, options)
    }
  }

  const success = (title: string, description?: string) => show({ type: 'success', title, description })
  const error = (title: string, description?: string) => show({ type: 'error', title, description })
  const warning = (title: string, description?: string) => show({ type: 'warning', title, description })
  const info = (title: string, description?: string) => show({ type: 'info', title, description })

  return {
    show,
    success,
    error,
    warning,
    info,
  }
}
