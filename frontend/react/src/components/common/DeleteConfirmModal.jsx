import Modal from './Modal'
import Button from './Button'
import { HiExclamationCircle } from 'react-icons/hi'
import './DeleteConfirmModal.css'

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar Eliminación',
  message = '¿Estás seguro de que deseas eliminar este elemento? Esta acción no se puede deshacer.',
  itemName,
  loading = false
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Eliminar
          </Button>
        </>
      }
    >
      <div className="delete-confirm">
        <div className="delete-icon">
          <HiExclamationCircle />
        </div>
        <p className="delete-message">{message}</p>
        {itemName && (
          <div className="delete-item-name">
            <strong>{itemName}</strong>
          </div>
        )}
      </div>
    </Modal>
  )
}

