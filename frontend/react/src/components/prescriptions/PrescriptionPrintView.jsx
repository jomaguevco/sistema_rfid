import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import Loading from '../common/Loading'
import Badge from '../common/Badge'
import Button from '../common/Button'
import { HiPrinter, HiX } from 'react-icons/hi'
import './PrescriptionPrintView.css'

export default function PrescriptionPrintView({ prescription, isOpen, onClose }) {
  const [isPrinting, setIsPrinting] = useState(false)

  const { data: fullPrescription, isLoading, error } = useQuery({
    queryKey: ['prescription-print', prescription?.id, prescription?.prescription_code],
    queryFn: async () => {
      if (!prescription?.prescription_code) {
        throw new Error('Código de receta no disponible')
      }
      const response = await api.get(`/prescriptions/${prescription.prescription_code}`)
      if (!response.data.success) {
        throw new Error(response.data.error || 'Error al cargar la receta')
      }
      return response.data.data
    },
    enabled: isOpen && !!prescription && !!prescription.prescription_code,
    retry: 1
  })

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const handlePrint = () => {
    if (!fullPrescription) return
    
    setIsPrinting(true)
    
    // Obtener el contenido de la receta
    const prescriptionContent = document.querySelector('.prescription-print')
    if (!prescriptionContent) {
      setIsPrinting(false)
      return
    }

    // Crear una nueva ventana para imprimir
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      alert('Por favor, permita las ventanas emergentes para imprimir')
      setIsPrinting(false)
      return
    }

    // Escribir el contenido HTML en la nueva ventana
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receta Médica - ${fullPrescription.prescription_code}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #1a202c;
            background: white;
            padding: 10mm;
          }
          
          .prescription-print {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
          }
          
          /* ENCABEZADO */
          .print-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 12px;
            border-bottom: 3px solid #0066CC;
            margin-bottom: 15px;
          }
          
          .print-logo .logo-placeholder {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #0066CC 0%, #004C99 100%);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            color: white;
          }
          
          .print-title {
            flex: 1;
            text-align: center;
          }
          
          .print-title h1 {
            font-size: 22pt;
            color: #1a365d;
            margin: 0;
            letter-spacing: 2px;
          }
          
          .print-title .print-subtitle {
            font-size: 10pt;
            color: #718096;
            margin-top: 3px;
          }
          
          .print-order-number {
            background: linear-gradient(135deg, #ebf8ff 0%, #e3f2fd 100%);
            border: 2px solid #0066CC;
            border-radius: 8px;
            padding: 8px 15px;
            text-align: center;
          }
          
          .print-order-number .label {
            display: block;
            font-size: 8pt;
            color: #718096;
            text-transform: uppercase;
          }
          
          .print-order-number .value {
            display: block;
            font-size: 14pt;
            font-weight: 700;
            color: #0066CC;
          }
          
          /* SECCIONES */
          .print-section {
            margin-bottom: 12px;
            padding: 10px 12px;
            border-radius: 6px;
          }
          
          .section-title {
            font-size: 11pt;
            font-weight: 700;
            color: #1a365d;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 2px solid #0066CC;
          }
          
          .info-row {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
          }
          
          .info-col {
            flex: 1;
            min-width: 120px;
          }
          
          .info-col-2 {
            flex: 2;
          }
          
          .info-col .label {
            font-size: 8pt;
            color: #718096;
            text-transform: uppercase;
            font-weight: 600;
            display: block;
            margin-bottom: 2px;
          }
          
          .info-col .value {
            font-size: 11pt;
            color: #1a202c;
            font-weight: 500;
          }
          
          .print-general-info {
            background-color: #f7fafc;
            border: 1px solid #e2e8f0;
          }
          
          .print-patient-section {
            background-color: #ebf8ff;
            border: 1px solid #90cdf4;
          }
          
          .print-medications-section {
            background-color: white;
            border: 1px solid #e2e8f0;
          }
          
          /* TABLA DE MEDICAMENTOS */
          .medications-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          
          .medications-table th,
          .medications-table td {
            padding: 8px 10px;
            text-align: left;
            border: 1px solid #e2e8f0;
          }
          
          .medications-table th {
            background-color: #0066CC;
            color: white;
            font-size: 9pt;
            font-weight: 600;
            text-transform: uppercase;
          }
          
          .medications-table td {
            font-size: 10pt;
            vertical-align: top;
          }
          
          .medications-table tr:nth-child(even) {
            background-color: #f7fafc;
          }
          
          .medications-table .col-item {
            width: 30px;
            text-align: center;
            font-weight: 700;
            color: #0066CC;
          }
          
          .concentration {
            color: #718096;
            font-weight: 400;
          }
          
          .item-instructions {
            margin-top: 4px;
            font-size: 9pt;
            color: #c53030;
            font-style: italic;
          }
          
          /* NOTAS */
          .print-notes-section {
            background-color: #fffaf0;
            border: 1px solid #fbd38d;
          }
          
          .notes-text {
            font-size: 10pt;
            color: #744210;
            font-style: italic;
          }
          
          /* SECCIÓN MÉDICO */
          .print-doctor-section {
            background-color: #f0fff4;
            border: 1px solid #9ae6b4;
          }
          
          .signature-area {
            margin-top: 20px;
            text-align: center;
          }
          
          .signature-box {
            display: inline-block;
            min-width: 250px;
          }
          
          .signature-line {
            border-bottom: 1px solid #2d3748;
            margin-bottom: 8px;
            height: 50px;
          }
          
          .signature-label {
            font-size: 9pt;
            color: #718096;
            text-align: center;
          }
          
          /* PIE DE PÁGINA */
          .print-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 20px;
            padding-top: 12px;
            border-top: 1px dashed #cbd5e0;
          }
          
          .footer-left .qr-code {
            width: 70px;
            height: 70px;
          }
          
          .footer-center {
            flex: 1;
            text-align: center;
          }
          
          .prescription-code {
            margin: 0;
            font-size: 12pt;
            color: #0066CC;
          }
          
          .verification-text {
            margin: 5px 0 0 0;
            font-size: 8pt;
            color: #718096;
          }
          
          .footer-right {
            text-align: right;
          }
          
          .print-date {
            margin: 0;
            font-size: 8pt;
            color: #a0aec0;
          }
          
          @media print {
            body {
              padding: 0;
            }
            
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        </style>
      </head>
      <body>
        ${prescriptionContent.outerHTML}
      </body>
      </html>
    `)

    printWindow.document.close()
    
    // Esperar a que se carguen las imágenes y luego imprimir
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus()
        printWindow.print()
        // Cerrar la ventana después de imprimir (opcional)
        // printWindow.close()
        setIsPrinting(false)
      }, 500)
    }
  }

  // Escuchar evento afterprint para cerrar el modal
  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPrinting(false)
    }
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [])

  if (!isOpen) return null

  return (
    <div className="print-overlay">
      {/* Barra de acciones (oculta en impresión) */}
      <div className="print-toolbar no-print">
        <div className="print-toolbar-info">
          <h3>Vista Previa de Impresión</h3>
          <span>Receta: {prescription?.prescription_code}</span>
        </div>
        <div className="print-toolbar-actions">
          <Button variant="primary" onClick={handlePrint} disabled={isLoading || isPrinting}>
            <HiPrinter />
            {isPrinting ? 'Imprimiendo...' : 'Imprimir Receta'}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            <HiX />
            Cerrar
          </Button>
        </div>
      </div>

      {/* Contenido de la receta (se imprime) */}
      <div className="print-content">
        {isLoading ? (
          <Loading text="Cargando receta..." />
        ) : error ? (
          <div className="print-error">
            <p>❌ Error al cargar la receta</p>
            <p>{error.message}</p>
          </div>
        ) : fullPrescription ? (
          <div className="prescription-print">
            {/* ENCABEZADO INSTITUCIONAL */}
            <div className="print-header">
              <div className="print-logo">
                <div className="logo-placeholder">🏥</div>
              </div>
              <div className="print-title">
                <h1>RECETA MÉDICA</h1>
                <p className="print-subtitle">Orden de Medicamentos</p>
              </div>
              <div className="print-order-number">
                <span className="label">N° Orden</span>
                <span className="value">{fullPrescription.receipt_number || fullPrescription.prescription_code}</span>
              </div>
            </div>

            {/* LÍNEA SEPARADORA */}
            <div className="print-divider"></div>

            {/* DATOS GENERALES */}
            <div className="print-section print-general-info">
              <div className="info-row">
                <div className="info-col">
                  <span className="label">Especialidad:</span>
                  <span className="value">{fullPrescription.specialty || 'General'}</span>
                </div>
                <div className="info-col">
                  <span className="label">Servicio:</span>
                  <span className="value">{fullPrescription.service || 'Farmacia Consulta Externa'}</span>
                </div>
                <div className="info-col">
                  <span className="label">Tipo Atención:</span>
                  <span className="value">{fullPrescription.attention_type || 'Consulta Externa'}</span>
                </div>
                <div className="info-col">
                  <span className="label">Fecha:</span>
                  <span className="value">{formatDate(fullPrescription.prescription_date)}</span>
                </div>
              </div>
            </div>

            {/* DATOS DEL PACIENTE */}
            <div className="print-section print-patient-section">
              <h2 className="section-title">👤 DATOS DEL PACIENTE</h2>
              <div className="info-row">
                <div className="info-col info-col-2">
                  <span className="label">Nombre:</span>
                  <span className="value">{fullPrescription.patient_name || '___________________________'}</span>
                </div>
                <div className="info-col">
                  <span className="label">DNI:</span>
                  <span className="value">{fullPrescription.patient_dni || fullPrescription.patient_id_number || '_______________'}</span>
                </div>
                <div className="info-col">
                  <span className="label">Teléfono:</span>
                  <span className="value">{fullPrescription.patient_phone || '_______________'}</span>
                </div>
              </div>
            </div>

            {/* MEDICAMENTOS */}
            <div className="print-section print-medications-section">
              <h2 className="section-title">💊 MEDICAMENTOS INDICADOS</h2>
              
              {fullPrescription.items && fullPrescription.items.length > 0 ? (
                <table className="medications-table">
                  <thead>
                    <tr>
                      <th className="col-item">#</th>
                      <th className="col-name">Medicamento</th>
                      <th className="col-qty">Cant.</th>
                      <th className="col-route">Vía</th>
                      <th className="col-dosage">Dosis</th>
                      <th className="col-duration">Duración</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullPrescription.items.map((item, index) => (
                      <tr key={item.id || index}>
                        <td className="col-item">{String.fromCharCode(65 + index)}</td>
                        <td className="col-name">
                          <strong>{item.product_name}</strong>
                          {item.concentration && <span className="concentration"> {item.concentration}</span>}
                          {item.instructions && (
                            <div className="item-instructions">
                              <em>{item.instructions}</em>
                            </div>
                          )}
                        </td>
                        <td className="col-qty">{item.quantity_required}</td>
                        <td className="col-route">{item.administration_route || 'Oral'}</td>
                        <td className="col-dosage">{item.dosage || '-'}</td>
                        <td className="col-duration">{item.duration || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="no-items">No hay medicamentos registrados</p>
              )}
            </div>

            {/* NOTAS */}
            {fullPrescription.notes && (
              <div className="print-section print-notes-section">
                <h2 className="section-title">📝 OBSERVACIONES</h2>
                <p className="notes-text">{fullPrescription.notes}</p>
              </div>
            )}

            {/* DATOS DEL MÉDICO Y FIRMA */}
            <div className="print-section print-doctor-section">
              <h2 className="section-title">⚕️ MÉDICO RESPONSABLE</h2>
              <div className="doctor-info">
                <div className="info-row">
                  <div className="info-col info-col-2">
                    <span className="label">Nombre:</span>
                    <span className="value">{fullPrescription.doctor_name || '___________________________'}</span>
                  </div>
                  <div className="info-col">
                    <span className="label">Colegiatura:</span>
                    <span className="value">{fullPrescription.doctor_license || '_______________'}</span>
                  </div>
                  <div className="info-col">
                    <span className="label">Especialidad:</span>
                    <span className="value">{fullPrescription.doctor_specialty || fullPrescription.specialty || '_______________'}</span>
                  </div>
                </div>
              </div>
              
              {/* Área de firma */}
              <div className="signature-area">
                <div className="signature-box">
                  <div className="signature-line"></div>
                  <p className="signature-label">Firma y Sello del Médico</p>
                </div>
              </div>
            </div>

            {/* PIE DE PÁGINA CON QR */}
            <div className="print-footer">
              <div className="footer-left">
                {fullPrescription.qr_code && (
                  <img src={fullPrescription.qr_code} alt="QR Code" className="qr-code" />
                )}
              </div>
              <div className="footer-center">
                <p className="prescription-code">Código: <strong>{fullPrescription.prescription_code}</strong></p>
                <p className="verification-text">Escanee el código QR para verificar la autenticidad de esta receta</p>
              </div>
              <div className="footer-right">
                <p className="print-date">Impreso: {new Date().toLocaleDateString('es-ES')} {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="print-error">
            <p>No se pudo cargar la receta</p>
          </div>
        )}
      </div>
    </div>
  )
}

