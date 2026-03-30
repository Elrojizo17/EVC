import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

const baseModalConfig = {
  confirmButtonColor: '#1e78bd',
  backdrop: 'rgba(15, 23, 42, 0.45)',
  zIndex: 4000,
  heightAuto: false,
  allowOutsideClick: true,
  allowEscapeKey: true,
  customClass: {
    container: 'evc-notification-container',
    popup: 'evc-notification-popup',
  },
};

export const useNotification = () => {
  const success = (message) => {
    return Swal.fire({
      ...baseModalConfig,
      icon: 'success',
      title: 'Registro exitoso',
      text: String(message || 'La operación se realizó correctamente.'),
      confirmButtonText: 'Aceptar',
    });
  };

  const error = (message) => {
    return Swal.fire({
      ...baseModalConfig,
      icon: 'error',
      title: 'No se pudo completar',
      text: String(message || 'Revisa los datos del formulario e intenta de nuevo.'),
      confirmButtonText: 'Entendido',
    });
  };

  const loading = (message) => {
    return toast.loading(message, {
      position: 'top-right',
      style: {
        background: '#3b82f6',
        color: '#fff',
        borderRadius: '8px',
        padding: '16px',
        fontSize: '14px',
        fontWeight: '500',
      },
    });
  };

  const info = (message) => {
    return Swal.fire({
      ...baseModalConfig,
      icon: 'info',
      title: 'Información',
      text: String(message || ''),
      confirmButtonText: 'Aceptar',
    });
  };

  const promise = (promiseFn, messages) => {
    return toast.promise(
      promiseFn,
      {
        loading: messages.loading || 'Cargando...',
        success: messages.success || 'Éxito',
        error: messages.error || 'Error',
      },
      {
        position: 'top-right',
        style: {
          borderRadius: '8px',
          padding: '16px',
          fontSize: '14px',
          fontWeight: '500',
        },
      }
    );
  };

  const dismiss = (toastId) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  };

  return { success, error, loading, info, promise, dismiss };
};
