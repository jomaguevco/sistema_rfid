import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Button from '../common/Button'
import Loading from '../common/Loading'
import { formatConcentration, normalizeRfidCode, isValidRfidCode } from '../../utils/formatting'
import './ProductForm.css'

export default function ProductForm({ product, isOpen, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const isEdit = !!product
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    product_type: 'medicamento',
    active_ingredient: '',
    concentration: '',
    presentation: '',
    administration_route: '',
    category_id: '',
    min_stock: 5,
    requires_refrigeration: false,
    units_per_package: 1,
    barcode: ''
  })
  
  const [errors, setErrors] = useState({})

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      try {
        const response = await api.get('/categories')
        return response.data.data || []
      } catch {
        return []
      }
    }
  })

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        product_type: product.product_type || 'medicamento',
        active_ingredient: product.active_ingredient || '',
        concentration: product.concentration || '',
        presentation: product.presentation || '',
        administration_route: product.administration_route || '',
        category_id: product.category_id || '',
        min_stock: product.min_stock || 5,
        requires_refrigeration: product.requires_refrigeration || false,
        units_per_package: product.units_per_package || 1,
        barcode: product.barcode || ''
      })
    } else {
      setFormData({
        name: '',
        description: '',
        product_type: 'medicamento',
        active_ingredient: '',
        concentration: '',
        presentation: '',
        administration_route: '',
        category_id: '',
        min_stock: 5,
        requires_refrigeration: false,
        units_per_package: 1,
        barcode: ''
      })
    }
    setErrors({})
  }, [product, isOpen])

  const validate = () => {
    const newErrors = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    }
    
    if (formData.min_stock < 0) {
      newErrors.min_stock = 'El stock mínimo no puede ser negativo'
    }
    
    if (formData.units_per_package < 1) {
      newErrors.units_per_package = 'Debe ser al menos 1'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/products', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['products'])
      onSuccess?.()
      onClose()
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.put(`/products/${product.id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['products'])
      onSuccess?.()
      onClose()
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!validate()) {
      return
    }

    // Formatear concentración si tiene valor
    let concentration = formData.concentration
    if (concentration && concentration.trim()) {
      concentration = formatConcentration(concentration, formData.product_type)
    }

    const submitData = {
      ...formData,
      concentration: concentration || null,
      category_id: formData.category_id ? parseInt(formData.category_id) : null,
      min_stock: parseInt(formData.min_stock),
      units_per_package: parseInt(formData.units_per_package),
      requires_refrigeration: formData.requires_refrigeration
    }

    if (isEdit) {
      updateMutation.mutate(submitData)
    } else {
      createMutation.mutate(submitData)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending
  const error = createMutation.error || updateMutation.error

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar Medicamento' : 'Nuevo Medicamento'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isLoading}
          >
            {isEdit ? 'Guardar Cambios' : 'Crear Medicamento'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="product-form">
        {error && (
          <div className="form-error" role="alert">
            {error.response?.data?.error || 'Error al guardar el medicamento'}
          </div>
        )}

        <div className="form-row">
          <Input
            label="Nombre del Medicamento *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="description">Descripción</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="input"
            />
          </div>
        </div>

        <div className="form-row form-row-2">
          <div className="form-group">
            <label>Tipo *</label>
            <select
              value={formData.product_type}
              onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
              className="input"
              required
            >
              <option value="medicamento">Medicamento</option>
              <option value="insumo">Insumo</option>
            </select>
          </div>

          <div className="form-group">
            <label>Categoría</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="input"
            >
              <option value="">Seleccionar categoría...</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {formData.product_type === 'medicamento' && (
          <>
            <div className="form-row form-row-2">
              <Input
                label="Principio Activo"
                value={formData.active_ingredient}
                onChange={(e) => setFormData({ ...formData, active_ingredient: e.target.value })}
              />
              <Input
                label="Concentración"
                value={formData.concentration}
                onChange={(e) => {
                  let value = e.target.value
                  // Si el usuario no agrega volumen, se agregará automáticamente al guardar
                  setFormData({ ...formData, concentration: value })
                }}
                onBlur={(e) => {
                  // Al perder el foco, formatear la concentración si tiene valor
                  if (e.target.value && e.target.value.trim()) {
                    const formatted = formatConcentration(e.target.value, formData.product_type)
                    setFormData({ ...formData, concentration: formatted })
                  }
                }}
                placeholder="Ej: 250mg (se agregará /5mL automáticamente)"
                helperText="Se agregará /5mL automáticamente si no se especifica volumen"
              />
            </div>

            <div className="form-row form-row-2">
              <Input
                label="Presentación"
                value={formData.presentation}
                onChange={(e) => setFormData({ ...formData, presentation: e.target.value })}
                placeholder="Ej: Tabletas, Ampollas"
              />
              <Input
                label="Vía de Administración"
                value={formData.administration_route}
                onChange={(e) => setFormData({ ...formData, administration_route: e.target.value })}
                placeholder="Ej: Oral, Intravenosa"
              />
            </div>
          </>
        )}

        <div className="form-row form-row-2">
          <Input
            label="Stock Mínimo *"
            type="number"
            min="0"
            value={formData.min_stock}
            onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
            error={errors.min_stock}
            required
          />
          <Input
            label="Unidades por Paquete *"
            type="number"
            min="1"
            value={formData.units_per_package}
            onChange={(e) => setFormData({ ...formData, units_per_package: e.target.value })}
            error={errors.units_per_package}
            helperText="1 = unidad individual, >1 = caja"
            required
          />
        </div>

        <div className="form-row form-row-2">
          <Input
            label="Código de Barras"
            value={formData.barcode}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            placeholder="Opcional"
          />
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.requires_refrigeration}
                onChange={(e) => setFormData({ ...formData, requires_refrigeration: e.target.checked })}
              />
              <span>Requiere Refrigeración</span>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  )
}

