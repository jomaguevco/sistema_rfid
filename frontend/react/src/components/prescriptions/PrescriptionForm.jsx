import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Button from '../common/Button'
import Badge from '../common/Badge'
import Loading from '../common/Loading'
import { HiPlus, HiTrash, HiX } from 'react-icons/hi'
import './PrescriptionForm.css'

export default function PrescriptionForm({ isOpen, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const { canViewStock, hasRole } = useAuth()
  const isMedico = hasRole('medico')
  
  const [formData, setFormData] = useState({
    patient_id: '',
    patient_name: '',
    patient_id_number: '',
    patient_phone: '',
    doctor_id: '',
    doctor_name: '',
    doctor_license: '',
    prescription_date: new Date().toISOString().split('T')[0],
    notes: '',
    // Nuevos campos formato institucional
    specialty: '',
    service: 'Farmacia Consulta Externa',
    attention_type: 'Consulta Externa'
  })
  
  const [items, setItems] = useState([])
  const [errors, setErrors] = useState({})
  const [itemForm, setItemForm] = useState({
    product_id: '',
    product_search: '',
    quantity_required: 1,
    instructions: '',
    // Nuevos campos formato institucional
    administration_route: 'Oral',
    dosage: '',
    duration: ''
  })
  const [productSearchResults, setProductSearchResults] = useState([])
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [selectedProductInfo, setSelectedProductInfo] = useState(null)
  
  // Búsqueda de pacientes
  const [patientSearch, setPatientSearch] = useState('')
  const [patientSearchResults, setPatientSearchResults] = useState([])
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  
  // Búsqueda de doctores
  const [doctorSearch, setDoctorSearch] = useState('')
  const [doctorSearchResults, setDoctorSearchResults] = useState([])
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [selectedArea, setSelectedArea] = useState('')

  const {
    data: doctorProfile,
    isLoading: loadingDoctorProfile,
    error: doctorProfileError
  } = useQuery({
    queryKey: ['doctor-profile'],
    queryFn: async () => {
      const response = await api.get('/doctors/me')
      return response.data.data
    },
    enabled: isOpen && isMedico,
    staleTime: 5 * 60 * 1000,
    retry: 1
  })

  const { data: areas } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      try {
        const response = await api.get('/areas?all=true')
        return response.data.data || []
      } catch {
        return []
      }
    },
    enabled: isOpen
  })

  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ['products-for-prescription', selectedDoctor?.specialty, selectedDoctor?.area_id],
    queryFn: async () => {
      const response = await api.get('/products?limit=500')
      return response.data.data || []
    },
    enabled: isOpen,
    select: (data) => {
      // Filtrar productos según restricciones de especialidad si hay doctor seleccionado
      if (!selectedDoctor || !selectedDoctor.specialty) {
        return data
      }
      
      // Por ahora retornamos todos los productos
      // La lógica de restricciones se implementará cuando se cree la tabla de restricciones
      return data
    }
  })

  // Búsqueda de pacientes
  const { data: patientsData } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: async () => {
      if (!patientSearch.trim()) return []
      const params = new URLSearchParams()
      params.append('search', patientSearch.trim())
      const response = await api.get(`/patients?${params.toString()}`)
      return response.data.data || []
    },
    enabled: isOpen && patientSearch.trim().length > 2
  })

  // Búsqueda de doctores
  const { data: doctorsData } = useQuery({
    queryKey: ['doctors-search', doctorSearch, selectedArea],
    queryFn: async () => {
      if (!doctorSearch.trim()) return []
      const params = new URLSearchParams()
      params.append('search', doctorSearch.trim())
      if (selectedArea) params.append('area_id', selectedArea)
      const response = await api.get(`/doctors?${params.toString()}`)
      return response.data.data || []
    },
    enabled: isOpen && !isMedico && doctorSearch.trim().length > 2
  })

  // Búsqueda de productos con autocompletado
  useEffect(() => {
    if (itemForm.product_search.trim() && products) {
      const searchTerm = itemForm.product_search.toLowerCase()
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        (p.active_ingredient && p.active_ingredient.toLowerCase().includes(searchTerm)) ||
        (p.barcode && p.barcode.includes(searchTerm))
      ).slice(0, 10)
      setProductSearchResults(filtered)
      setShowProductDropdown(filtered.length > 0)
    } else {
      setProductSearchResults([])
      setShowProductDropdown(false)
    }
  }, [itemForm.product_search, products])

  // Debug: Log del estado de itemForm cuando cambia
  useEffect(() => {
    console.log('🔍 [DEBUG] itemForm cambió:', {
      product_id: itemForm.product_id,
      product_id_type: typeof itemForm.product_id,
      quantity_required: itemForm.quantity_required,
      quantity_type: typeof itemForm.quantity_required,
      canAdd: !!(itemForm.product_id && itemForm.quantity_required && parseInt(itemForm.quantity_required) >= 1)
    })
  }, [itemForm])

  // Actualizar resultados de búsqueda de pacientes
  useEffect(() => {
    if (patientsData) {
      setPatientSearchResults(patientsData.slice(0, 10))
      setShowPatientDropdown(patientsData.length > 0)
    } else {
      setPatientSearchResults([])
      setShowPatientDropdown(false)
    }
  }, [patientsData])

  // Actualizar resultados de búsqueda de doctores
  useEffect(() => {
    if (doctorsData) {
      setDoctorSearchResults(doctorsData.slice(0, 10))
      setShowDoctorDropdown(doctorsData.length > 0)
    } else {
      setDoctorSearchResults([])
      setShowDoctorDropdown(false)
    }
  }, [doctorsData])

  useEffect(() => {
    if (!isOpen || !isMedico || !doctorProfile) return

    setSelectedDoctor(doctorProfile)
    setDoctorSearch(doctorProfile.name || '')
    setSelectedArea(doctorProfile.area_id ? String(doctorProfile.area_id) : '')
    setFormData((prev) => ({
      ...prev,
      doctor_id: doctorProfile.id || '',
      doctor_name: doctorProfile.name || '',
      doctor_license: doctorProfile.license_number || ''
    }))
  }, [isOpen, isMedico, doctorProfile])

  useEffect(() => {
    if (!isOpen || !isMedico) return
    if (!loadingDoctorProfile && !doctorProfile) {
      setSelectedDoctor(null)
      setDoctorSearch('')
      setFormData((prev) => ({
        ...prev,
        doctor_id: '',
        doctor_name: '',
        doctor_license: ''
      }))
    }
  }, [isOpen, isMedico, loadingDoctorProfile, doctorProfile])

  const selectProduct = (product) => {
    console.log('🔍 [DEBUG] selectProduct llamado con:', product)
    console.log('🔍 [DEBUG] Campos del producto:', Object.keys(product))
    console.log('🔍 [DEBUG] product.id:', product.id)
    console.log('🔍 [DEBUG] product.product_id:', product.product_id)
    
    // El endpoint /products retorna productos con product_id, no id
    const productId = parseInt(product.product_id || product.id) || product.product_id || product.id
    
    console.log('🔍 [DEBUG] productId calculado:', productId, 'tipo:', typeof productId)
    
    if (!productId) {
      console.error('❌ [DEBUG] No se pudo obtener product_id del producto:', product)
      alert('Error: No se pudo obtener el ID del producto. Por favor, intenta nuevamente.')
      return
    }
    
    // Usar función de actualización de estado para asegurar que se actualice correctamente
    setItemForm(prev => {
      const newForm = {
        ...prev,
        product_id: productId,
        product_search: `${product.name}${product.active_ingredient ? ` - ${product.active_ingredient}` : ''}`
      }
      console.log('🔍 [DEBUG] Nuevo itemForm en setItemForm:', newForm)
      return newForm
    })
    
    setSelectedProductInfo(product)
    setShowProductDropdown(false)
    
    console.log('✅ [DEBUG] Producto seleccionado exitosamente, product_id:', productId)
  }

  const selectPatient = (patient) => {
    setFormData({
      ...formData,
      patient_id: patient.id,
      patient_name: patient.name,
      patient_id_number: patient.id_number || ''
    })
    setSelectedPatient(patient)
    setShowPatientDropdown(false)
    setPatientSearch(patient.name)
  }

  const selectDoctor = (doctor) => {
    setFormData({
      ...formData,
      doctor_id: doctor.id,
      doctor_name: doctor.name,
      doctor_license: doctor.license_number || ''
    })
    setSelectedDoctor(doctor)
    setShowDoctorDropdown(false)
    setDoctorSearch(doctor.name)
  }

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        patient_id: '',
        patient_name: '',
        patient_id_number: '',
        patient_phone: '',
        doctor_id: '',
        doctor_name: '',
        doctor_license: '',
        prescription_date: new Date().toISOString().split('T')[0],
        notes: '',
        specialty: '',
        service: 'Farmacia Consulta Externa',
        attention_type: 'Consulta Externa'
      })
      setItems([])
      setItemForm({
        product_id: '',
        product_search: '',
        quantity_required: 1,
        instructions: '',
        administration_route: 'Oral',
        dosage: '',
        duration: ''
      })
      setSelectedProductInfo(null)
      setSelectedPatient(null)
      setSelectedDoctor(null)
      setPatientSearch('')
      setDoctorSearch('')
      setSelectedArea('')
      setErrors({})
    }
  }, [isOpen])

  // Constantes de validación (sincronizadas con backend)
  const VALIDATION_RULES = {
    MAX_ITEMS_PER_PRESCRIPTION: 20,
    MIN_QUANTITY: 1,
    MAX_QUANTITY_PER_ITEM: 10000
  }

  const validate = () => {
    const newErrors = {}
    
    if (!formData.patient_id && !formData.patient_name.trim()) {
      newErrors.patient_name = 'Debe seleccionar o ingresar un paciente'
    }
    
    if (!formData.doctor_id && !formData.doctor_name.trim()) {
      newErrors.doctor_name = 'Debe seleccionar o ingresar un médico'
    }
    
    if (!formData.prescription_date) {
      newErrors.prescription_date = 'La fecha de receta es requerida'
    } else {
      // VALIDACIÓN: La fecha de receta no puede ser futura
      const prescriptionDate = new Date(formData.prescription_date)
      const today = new Date()
      today.setHours(23, 59, 59, 999) // Fin del día
      
      if (prescriptionDate > today) {
        newErrors.prescription_date = 'La fecha de la receta no puede ser futura'
      }
    }
    
    if (items.length === 0) {
      newErrors.items = 'Debe agregar al menos un medicamento'
    } else if (items.length > VALIDATION_RULES.MAX_ITEMS_PER_PRESCRIPTION) {
      newErrors.items = `La receta no puede tener más de ${VALIDATION_RULES.MAX_ITEMS_PER_PRESCRIPTION} medicamentos`
    }

    // Validar cantidades de cada item
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const qty = parseInt(item.quantity_required, 10)
      if (isNaN(qty) || qty < VALIDATION_RULES.MIN_QUANTITY) {
        newErrors.items = `El medicamento "${item.product_name}" tiene una cantidad inválida`
        break
      }
      if (qty > VALIDATION_RULES.MAX_QUANTITY_PER_ITEM) {
        newErrors.items = `El medicamento "${item.product_name}" excede la cantidad máxima permitida (${VALIDATION_RULES.MAX_QUANTITY_PER_ITEM})`
        break
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const addItem = () => {
    console.log('🔍 [DEBUG] addItem llamado')
    console.log('🔍 [DEBUG] itemForm:', itemForm)
    console.log('🔍 [DEBUG] selectedProductInfo:', selectedProductInfo)
    console.log('🔍 [DEBUG] products:', products)
    
    // Validar que quantity_required sea un número válido
    const quantityValue = parseInt(itemForm.quantity_required)
    console.log('🔍 [DEBUG] quantityValue:', quantityValue)
    
    if (!itemForm.product_id) {
      console.error('❌ [DEBUG] No hay product_id')
      alert('Por favor, selecciona un medicamento de la lista desplegable')
      return
    }
    
    if (!quantityValue || quantityValue < VALIDATION_RULES.MIN_QUANTITY || isNaN(quantityValue)) {
      console.error('❌ [DEBUG] Cantidad inválida:', quantityValue)
      alert('Por favor, especifica una cantidad válida (mayor a 0)')
      return
    }

    // VALIDACIÓN: Cantidad máxima por item
    if (quantityValue > VALIDATION_RULES.MAX_QUANTITY_PER_ITEM) {
      alert(`La cantidad máxima permitida es ${VALIDATION_RULES.MAX_QUANTITY_PER_ITEM} unidades`)
      return
    }

    // VALIDACIÓN: Límite de items por receta
    if (items.length >= VALIDATION_RULES.MAX_ITEMS_PER_PRESCRIPTION) {
      alert(`No se pueden agregar más de ${VALIDATION_RULES.MAX_ITEMS_PER_PRESCRIPTION} medicamentos por receta`)
      return
    }

    const productId = parseInt(itemForm.product_id)
    console.log('🔍 [DEBUG] productId:', productId)
    
    if (!products || products.length === 0) {
      console.error('❌ [DEBUG] No hay productos cargados')
      alert('Error: Los productos no están cargados. Por favor, espera un momento e intenta nuevamente.')
      return
    }
    
    // Buscar por product_id o id (el endpoint /products retorna product_id)
    const product = products.find(p => (p.product_id || p.id) === productId)
    console.log('🔍 [DEBUG] product encontrado:', product)
    
    if (!product) {
      console.error('❌ [DEBUG] Producto no encontrado con id:', productId)
      alert(`Error: No se encontró el producto seleccionado (ID: ${productId}). Por favor, selecciona el medicamento nuevamente.`)
      return
    }

    // Verificar que no se agregue el mismo producto dos veces
    const existingItem = items.find(item => item.product_id === productId)
    if (existingItem) {
      alert(`El medicamento "${product.name}" ya está en la lista. Si necesitas más cantidad, elimínalo y vuelve a agregarlo con la cantidad total deseada.`)
      return
    }

    const newItem = {
      id: Date.now(),
      product_id: productId,
      product_name: product.name,
      quantity_required: quantityValue,
      instructions: itemForm.instructions.trim(),
      // Nuevos campos formato institucional
      administration_route: itemForm.administration_route || 'Oral',
      dosage: itemForm.dosage.trim() || null,
      duration: itemForm.duration.trim() || null
    }

    console.log('✅ [DEBUG] Agregando item:', newItem)
    setItems([...items, newItem])
    setItemForm({
      product_id: '',
      product_search: '',
      quantity_required: 1,
      instructions: '',
      administration_route: 'Oral',
      dosage: '',
      duration: ''
    })
    setSelectedProductInfo(null)
    setShowProductDropdown(false)
    console.log('✅ [DEBUG] Item agregado exitosamente')
  }

  const removeItem = (itemId) => {
    setItems(items.filter(item => item.id !== itemId))
  }

  const createMutation = useMutation({
    mutationFn: async (data) => {
      try {
        console.log('📤 Enviando datos de receta:', data)
        const response = await api.post('/prescriptions', data)
        console.log('✅ Receta creada exitosamente:', response.data)
        return response.data
      } catch (err) {
        console.error('❌ Error al crear receta:', err)
        console.error('Detalles:', err.response?.data)
        throw err
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['prescriptions'])
      queryClient.invalidateQueries(['prescription'])
      queryClient.invalidateQueries(['prescription-items'])
      console.log('✅ Receta creada, queries invalidadas')
      onSuccess?.(data)
      onClose()
    },
    onError: (error) => {
      console.error('❌ Error en mutation:', error)
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!validate()) {
      return
    }

    // Asegurar tipos correctos antes de enviar
    const submitData = {
      patient_name: formData.patient_name.trim(),
      patient_id: formData.patient_id ? parseInt(formData.patient_id) : null,
      patient_id_number: formData.patient_id_number?.trim() || null,
      patient_phone: formData.patient_phone?.trim() || null,
      doctor_name: formData.doctor_name.trim(),
      doctor_id: formData.doctor_id ? parseInt(formData.doctor_id) : null,
      doctor_license: formData.doctor_license?.trim() || null,
      prescription_date: formData.prescription_date,
      notes: formData.notes?.trim() || null,
      // Nuevos campos formato institucional
      specialty: formData.specialty?.trim() || null,
      service: formData.service?.trim() || 'Farmacia Consulta Externa',
      attention_type: formData.attention_type?.trim() || 'Consulta Externa',
      items: items.map(item => ({
        product_id: parseInt(item.product_id) || item.product_id,
        quantity_required: parseInt(item.quantity_required) || item.quantity_required,
        instructions: item.instructions || null,
        // Nuevos campos de item
        administration_route: item.administration_route || 'Oral',
        dosage: item.dosage || null,
        duration: item.duration || null
      }))
    }

    createMutation.mutate(submitData)
  }

  const isLoading = createMutation.isPending
  const error = createMutation.error
  const shouldShowManualDoctorInputs = !isMedico || (!loadingDoctorProfile && !doctorProfile)
  const doctorAutoFillErrorMsg = isMedico && !loadingDoctorProfile && doctorProfileError
    ? doctorProfileError.response?.data?.error || 'No se encontró tu perfil médico. Completa los datos manualmente.'
    : null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva Receta Médica"
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
            Guardar Receta
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="prescription-form">
        {error && (
          <div className="form-error" role="alert">
            {error.response?.data?.error || 'Error al crear la receta'}
          </div>
        )}

        <div className="form-section">
          <h4>Información del Paciente</h4>
          <div className="form-row form-row-2">
            <div className="form-group" style={{ position: 'relative' }}>
              <label>Buscar Paciente <span className="input-required">*</span></label>
              <Input
                placeholder="Buscar por nombre o DNI..."
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value)
                  if (!e.target.value.trim()) {
                    setSelectedPatient(null)
                    setFormData({ ...formData, patient_id: '', patient_name: '', patient_id_number: '' })
                  }
                }}
                onFocus={() => {
                  if (patientSearchResults.length > 0) setShowPatientDropdown(true)
                }}
                onBlur={() => {
                  setTimeout(() => setShowPatientDropdown(false), 200)
                }}
                error={errors.patient_name}
              />
              {showPatientDropdown && patientSearchResults.length > 0 && (
                <div className="patient-dropdown" onMouseDown={(e) => e.preventDefault()}>
                  {patientSearchResults.map((patient) => (
                    <div
                      key={patient.id}
                      className="patient-dropdown-item"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        selectPatient(patient)
                      }}
                    >
                      <div className="patient-dropdown-name">{patient.name}</div>
                      {patient.id_number && (
                        <div className="patient-dropdown-detail">DNI: {patient.id_number}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {selectedPatient && (
                <div className="selected-info">
                  <strong>{selectedPatient.name}</strong>
                  {selectedPatient.id_number && <span>DNI: {selectedPatient.id_number}</span>}
                </div>
              )}
            </div>
            {!selectedPatient && (
              <Input
                label="Nombre del Paciente (si no está registrado)"
                value={formData.patient_name}
                onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                error={errors.patient_name}
                required={!selectedPatient}
              />
            )}
          </div>
          {!selectedPatient && (
            <div className="form-row form-row-2">
              <Input
                label="DNI/ID (Opcional)"
                value={formData.patient_id_number}
                onChange={(e) => setFormData({ ...formData, patient_id_number: e.target.value })}
              />
              <Input
                label="Teléfono (Opcional)"
                type="tel"
                value={formData.patient_phone}
                onChange={(e) => setFormData({ ...formData, patient_phone: e.target.value })}
                placeholder="Ej: 987654321"
              />
            </div>
          )}
        </div>

        <div className="form-section">
          <h4>Información del Médico</h4>

          {isMedico && (
            <div className="auto-doctor-panel">
              {loadingDoctorProfile ? (
                <Loading text="Cargando tu información médica..." size="sm" />
              ) : doctorProfile ? (
                <div className="selected-info">
                  <strong>{doctorProfile.name}</strong>
                  <div className="selected-info-details">
                    {doctorProfile.specialty && <span>Especialidad: {doctorProfile.specialty}</span>}
                    {doctorProfile.area_name && <span>Área: {doctorProfile.area_name}</span>}
                    {doctorProfile.license_number && <span>Colegiatura: {doctorProfile.license_number}</span>}
                    {doctorProfile.email && <span>Email: {doctorProfile.email}</span>}
                  </div>
                  <small>Estos datos provienen de tu perfil médico y no pueden editarse.</small>
                </div>
              ) : (
                doctorAutoFillErrorMsg && (
                  <div className="form-error" role="alert">
                    {doctorAutoFillErrorMsg}
                  </div>
                )
              )}
            </div>
          )}

          {shouldShowManualDoctorInputs && (
            <>
              <div className="form-group">
                <label>Área (Opcional - para filtrar médicos)</label>
                <select
                  value={selectedArea}
                  onChange={(e) => {
                    setSelectedArea(e.target.value)
                    setDoctorSearch('')
                    setSelectedDoctor(null)
                    setFormData({ ...formData, doctor_id: '', doctor_name: '', doctor_license: '' })
                  }}
                  className="input"
                >
                  <option value="">Todas las áreas</option>
                  {areas?.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Buscar Médico <span className="input-required">*</span></label>
                  <Input
                    placeholder="Buscar por nombre, especialidad o colegiatura..."
                    value={doctorSearch}
                    onChange={(e) => {
                      setDoctorSearch(e.target.value)
                      if (!e.target.value.trim()) {
                        setSelectedDoctor(null)
                        setFormData({ ...formData, doctor_id: '', doctor_name: '', doctor_license: '' })
                      }
                    }}
                    onFocus={() => {
                      if (doctorSearchResults.length > 0) setShowDoctorDropdown(true)
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowDoctorDropdown(false), 200)
                    }}
                    error={errors.doctor_name}
                  />
                  {showDoctorDropdown && doctorSearchResults.length > 0 && (
                    <div className="doctor-dropdown" onMouseDown={(e) => e.preventDefault()}>
                      {doctorSearchResults.map((doctor) => (
                        <div
                          key={doctor.id}
                          className="doctor-dropdown-item"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            selectDoctor(doctor)
                          }}
                        >
                          <div className="doctor-dropdown-name">{doctor.name}</div>
                          {doctor.specialty && (
                            <div className="doctor-dropdown-detail">Especialidad: {doctor.specialty}</div>
                          )}
                          {doctor.area_name && (
                            <div className="doctor-dropdown-detail">Área: {doctor.area_name}</div>
                          )}
                          {doctor.license_number && (
                            <div className="doctor-dropdown-detail">Colegiatura: {doctor.license_number}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedDoctor && (
                    <div className="selected-info">
                      <strong>{selectedDoctor.name}</strong>
                      {selectedDoctor.specialty && <span>Especialidad: {selectedDoctor.specialty}</span>}
                      {selectedDoctor.area_name && <span>Área: {selectedDoctor.area_name}</span>}
                    </div>
                  )}
                </div>
                {!selectedDoctor && (
                  <Input
                    label="Nombre del Médico (si no está registrado)"
                    value={formData.doctor_name}
                    onChange={(e) => setFormData({ ...formData, doctor_name: e.target.value })}
                    error={errors.doctor_name}
                    required={!selectedDoctor}
                  />
                )}
              </div>
              {!selectedDoctor && (
                <Input
                  label="Número de Colegiatura (Opcional)"
                  value={formData.doctor_license}
                  onChange={(e) => setFormData({ ...formData, doctor_license: e.target.value })}
                />
              )}
            </>
          )}
        </div>

        <div className="form-section">
          <h4>Datos de la Receta</h4>
          <div className="form-row form-row-2">
            <Input
              label="Fecha de Receta"
              type="date"
              value={formData.prescription_date}
              onChange={(e) => setFormData({ ...formData, prescription_date: e.target.value })}
              error={errors.prescription_date}
              required
            />
            <div className="form-group">
              <label>Tipo de Atención</label>
              <select
                value={formData.attention_type}
                onChange={(e) => setFormData({ ...formData, attention_type: e.target.value })}
                className="input"
              >
                <option value="Consulta Externa">Consulta Externa</option>
                <option value="Emergencia">Emergencia</option>
                <option value="Hospitalización">Hospitalización</option>
                <option value="Cirugía">Cirugía</option>
                <option value="UCI">UCI</option>
              </select>
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Servicio</label>
              <select
                value={formData.service}
                onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                className="input"
              >
                <option value="Farmacia Consulta Externa">Farmacia Consulta Externa</option>
                <option value="Farmacia Emergencia">Farmacia Emergencia</option>
                <option value="Farmacia Hospitalización">Farmacia Hospitalización</option>
                <option value="Farmacia Oncología">Farmacia Oncología</option>
                <option value="Farmacia Pediatría">Farmacia Pediatría</option>
              </select>
            </div>
            <div className="form-group">
              <label>Notas (Opcional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="input"
                placeholder="Notas adicionales sobre la receta..."
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>Medicamentos</h4>
          {errors.items && (
            <div className="form-error" role="alert">
              {errors.items}
            </div>
          )}

          <div className="item-form">
            <div className="form-row form-row-3">
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Medicamento <span className="input-required">*</span></label>
                <Input
                  placeholder="Buscar medicamento..."
                  value={itemForm.product_search}
                  onChange={(e) => {
                    setItemForm({ ...itemForm, product_search: e.target.value, product_id: '' })
                    setSelectedProductInfo(null)
                  }}
                  onFocus={() => {
                    if (productSearchResults.length > 0) setShowProductDropdown(true)
                  }}
                  onBlur={() => {
                    // Delay para permitir el click en el dropdown
                    setTimeout(() => setShowProductDropdown(false), 200)
                  }}
                />
                {showProductDropdown && productSearchResults.length > 0 && (
                  <div className="product-dropdown" onMouseDown={(e) => e.preventDefault()}>
                    {productSearchResults.map((product) => (
                      <div
                        key={product.product_id || product.id || Math.random()}
                        className="product-dropdown-item"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          selectProduct(product)
                        }}
                      >
                        <div className="product-dropdown-name">{product.name}</div>
                        {product.active_ingredient && (
                          <div className="product-dropdown-detail">Principio activo: {product.active_ingredient}</div>
                        )}
                        {canViewStock() && product.total_stock !== undefined && (
                          <div className="product-dropdown-stock">
                            Stock: <Badge variant={product.total_stock > 0 ? 'success' : 'error'} size="sm">
                              {product.total_stock || 0}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {selectedProductInfo && (
                  <div className="selected-product-info">
                    <div className="product-info-row">
                      <strong>{selectedProductInfo.name}</strong>
                      {selectedProductInfo.active_ingredient && (
                        <span className="product-detail">Principio activo: {selectedProductInfo.active_ingredient}</span>
                      )}
                    </div>
                    <div className="product-info-row">
                      {canViewStock() && (
                        <Badge variant={selectedProductInfo.total_stock > 0 ? 'success' : 'error'} size="sm">
                          Stock disponible: {selectedProductInfo.total_stock || 0}
                        </Badge>
                      )}
                      {selectedProductInfo.requires_refrigeration && (
                        <Badge variant="warning" size="sm">Requiere refrigeración</Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Input
                label="Cantidad"
                type="number"
                min="1"
                value={itemForm.quantity_required}
                onChange={(e) => {
                  const value = e.target.value
                  // Convertir a número, mantener como string solo si está vacío
                  const numValue = value === '' ? 1 : Math.max(1, parseInt(value) || 1)
                  setItemForm({ ...itemForm, quantity_required: numValue })
                }}
                required
              />
              <Button
                type="button"
                variant="primary"
                onClick={addItem}
                disabled={(() => {
                  const hasProductId = !!itemForm.product_id && itemForm.product_id !== '' && itemForm.product_id !== null && itemForm.product_id !== undefined
                  const quantity = parseInt(itemForm.quantity_required) || 0
                  const hasValidQuantity = quantity >= 1
                  const isDisabled = !hasProductId || !hasValidQuantity
                  
                  console.log('🔍 [DEBUG] Validación del botón:', {
                    hasProductId,
                    hasValidQuantity,
                    product_id: itemForm.product_id,
                    quantity_required: itemForm.quantity_required,
                    quantity,
                    isDisabled
                  })
                  
                  return isDisabled
                })()}
              >
                <HiPlus />
                Agregar
              </Button>
            </div>
            <div className="form-row form-row-3">
              <div className="form-group">
                <label>Vía de Administración</label>
                <select
                  value={itemForm.administration_route}
                  onChange={(e) => setItemForm({ ...itemForm, administration_route: e.target.value })}
                  className="input"
                >
                  <option value="Oral">Oral</option>
                  <option value="Sublingual">Sublingual</option>
                  <option value="Intravenosa (IV)">Intravenosa (IV)</option>
                  <option value="Intramuscular (IM)">Intramuscular (IM)</option>
                  <option value="Subcutánea (SC)">Subcutánea (SC)</option>
                  <option value="Tópica">Tópica</option>
                  <option value="Oftálmica">Oftálmica</option>
                  <option value="Ótica">Ótica</option>
                  <option value="Nasal">Nasal</option>
                  <option value="Inhalatoria">Inhalatoria</option>
                  <option value="Rectal">Rectal</option>
                  <option value="Vaginal">Vaginal</option>
                </select>
              </div>
              <Input
                label="Dosis"
                value={itemForm.dosage}
                onChange={(e) => setItemForm({ ...itemForm, dosage: e.target.value })}
                placeholder="Ej: 1 tableta cada 8 horas"
              />
              <Input
                label="Duración"
                value={itemForm.duration}
                onChange={(e) => setItemForm({ ...itemForm, duration: e.target.value })}
                placeholder="Ej: 30 días"
              />
            </div>
            <Input
              label="Instrucciones adicionales (Opcional)"
              value={itemForm.instructions}
              onChange={(e) => setItemForm({ ...itemForm, instructions: e.target.value })}
              placeholder="Indicaciones especiales..."
            />
          </div>

          {items.length > 0 && (
            <div className="items-list">
              {items.map((item) => (
                <div key={item.id} className="item-card">
                  <div className="item-info">
                    <strong>{item.product_name}</strong>
                    <div className="item-details">
                      <Badge variant="info">Cantidad: {item.quantity_required}</Badge>
                      <Badge variant="secondary">{item.administration_route || 'Oral'}</Badge>
                      {item.dosage && <Badge variant="outline">{item.dosage}</Badge>}
                      {item.duration && <Badge variant="outline">{item.duration}</Badge>}
                    </div>
                    {item.instructions && (
                      <span className="item-instructions">{item.instructions}</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => removeItem(item.id)}
                  >
                    <HiTrash />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}

