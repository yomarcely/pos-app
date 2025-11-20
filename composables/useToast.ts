import type { ToastItem } from '@/components/ui/toast/Toaster.vue'

let toasterInstance: any = null

export function setToasterInstance(instance: any) {
  toasterInstance = instance
}

export function useToast() {
  const show = (toast: Omit<ToastItem, 'id'>) => {
    if (!toasterInstance) {
      console.warn('Toaster instance not found')
      return
    }
    return toasterInstance.addToast(toast)
  }

  const success = (title: string, description?: string) => {
    return show({ type: 'success', title, description })
  }

  const error = (title: string, description?: string) => {
    return show({ type: 'error', title, description })
  }

  const warning = (title: string, description?: string) => {
    return show({ type: 'warning', title, description })
  }

  const info = (title: string, description?: string) => {
    return show({ type: 'info', title, description })
  }

  return {
    show,
    success,
    error,
    warning,
    info
  }
}
