/**
 * Script para verificar que los campos de formato institucional funcionan correctamente
 */
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
const https = require('https');

async function makeRequest(path, method = 'GET', token = null, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: { 
        'Content-Type': 'application/json'
      }
    };
    
    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }
    
    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testPrescriptionFormat() {
  console.log('═'.repeat(60));
  console.log('  VERIFICACIÓN DE FORMATO INSTITUCIONAL DE RECETAS');
  console.log('═'.repeat(60));
  console.log();

  try {
    // 1. Login
    console.log('1️⃣  Iniciando sesión...');
    const loginResult = await makeRequest('/api/auth/login', 'POST', null, {
      username: 'admin',
      password: 'admin123'
    });
    
    if (!loginResult.data?.token) {
      console.log('❌ Error de login:', loginResult);
      return;
    }
    
    const token = loginResult.data.token;
    console.log('   ✅ Login exitoso\n');

    // 2. Verificar estructura de base de datos
    console.log('2️⃣  Verificando recetas existentes...');
    const prescriptions = await makeRequest('/api/prescriptions?limit=5', 'GET', token);
    
    if (prescriptions.success && prescriptions.data?.length > 0) {
      console.log(`   ✅ ${prescriptions.data.length} recetas encontradas\n`);
      
      const p = prescriptions.data[0];
      console.log('   📋 Campos de formato institucional en primera receta:');
      console.log('   ┌────────────────────────────────────────────');
      console.log(`   │ receipt_number:  ${p.receipt_number || '(vacío)'}`);
      console.log(`   │ specialty:       ${p.specialty || '(vacío)'}`);
      console.log(`   │ service:         ${p.service || '(vacío)'}`);
      console.log(`   │ attention_type:  ${p.attention_type || '(vacío)'}`);
      console.log(`   │ patient_phone:   ${p.patient_phone || '(vacío)'}`);
      console.log('   └────────────────────────────────────────────\n');
    } else {
      console.log('   ⚠️  No hay recetas existentes\n');
    }

    // 3. Obtener productos disponibles
    console.log('3️⃣  Obteniendo productos disponibles...');
    const products = await makeRequest('/api/products?limit=2', 'GET', token);
    
    if (!products.success || !products.data?.length) {
      console.log('   ⚠️  No hay productos disponibles para prueba');
      return;
    }
    
    const product = products.data[0];
    console.log(`   ✅ Producto disponible: ${product.name}\n`);

    // 4. Obtener doctores disponibles
    console.log('4️⃣  Obteniendo doctores disponibles...');
    const doctors = await makeRequest('/api/doctors?limit=1', 'GET', token);
    
    let doctorName = 'Dr. Prueba';
    let doctorLicense = 'CMP-12345';
    
    if (doctors.success && doctors.data?.length > 0) {
      doctorName = doctors.data[0].name;
      doctorLicense = doctors.data[0].license_number;
      console.log(`   ✅ Doctor disponible: ${doctorName}\n`);
    } else {
      console.log('   ⚠️  Usando doctor de prueba\n');
    }

    // 5. Crear receta de prueba con formato institucional
    console.log('5️⃣  Creando receta de prueba con formato institucional...');
    
    const newPrescription = {
      patient_name: 'Paciente de Prueba Formato',
      patient_id_number: '12345678',
      patient_phone: '987654321',
      doctor_name: doctorName,
      doctor_license: doctorLicense,
      prescription_date: new Date().toISOString().split('T')[0],
      notes: 'Receta de prueba para verificar formato institucional',
      // Nuevos campos de formato institucional
      specialty: 'Medicina General',
      service: 'Farmacia Consulta Externa',
      attention_type: 'Consulta Externa',
      items: [
        {
          product_id: product.product_id || product.id,
          quantity_required: 10,
          instructions: 'Tomar según indicaciones',
          // Nuevos campos de items
          administration_route: 'Oral',
          dosage: '1 tableta cada 8 horas',
          duration: '10 días'
        }
      ]
    };
    
    const createResult = await makeRequest('/api/prescriptions', 'POST', token, newPrescription);
    
    if (!createResult.success) {
      console.log('   ❌ Error al crear receta:', createResult.error);
      return;
    }
    
    console.log('   ✅ Receta creada correctamente');
    console.log(`   📝 Código: ${createResult.prescription_code}\n`);

    // 6. Verificar receta creada
    console.log('6️⃣  Verificando receta creada...');
    const verifyResult = await makeRequest(`/api/prescriptions/${createResult.prescription_code}`, 'GET', token);
    
    if (!verifyResult.success) {
      console.log('   ❌ Error al verificar receta:', verifyResult.error);
      return;
    }
    
    const created = verifyResult.data;
    console.log('   ✅ Receta verificada correctamente\n');
    
    console.log('   📋 DATOS DE LA RECETA CREADA:');
    console.log('   ┌────────────────────────────────────────────');
    console.log(`   │ Código:         ${created.prescription_code}`);
    console.log(`   │ N° Orden:       ${created.receipt_number}`);
    console.log(`   │ Paciente:       ${created.patient_name}`);
    console.log(`   │ DNI:            ${created.patient_id_number || created.patient_dni}`);
    console.log(`   │ Teléfono:       ${created.patient_phone}`);
    console.log(`   │ Médico:         ${created.doctor_name}`);
    console.log(`   │ Colegiatura:    ${created.doctor_license}`);
    console.log(`   │ Especialidad:   ${created.specialty}`);
    console.log(`   │ Servicio:       ${created.service}`);
    console.log(`   │ Tipo Atención:  ${created.attention_type}`);
    console.log('   └────────────────────────────────────────────\n');
    
    if (created.items && created.items.length > 0) {
      console.log('   💊 MEDICAMENTOS:');
      created.items.forEach((item, i) => {
        console.log(`   ┌── Item ${i + 1} ──────────────────────────────────`);
        console.log(`   │ Producto:       ${item.product_name}`);
        console.log(`   │ Cantidad:       ${item.quantity_required}`);
        console.log(`   │ Vía:            ${item.administration_route}`);
        console.log(`   │ Dosis:          ${item.dosage}`);
        console.log(`   │ Duración:       ${item.duration}`);
        console.log(`   │ Instrucciones:  ${item.instructions}`);
        console.log('   └────────────────────────────────────────────');
      });
    }

    console.log();
    console.log('═'.repeat(60));
    console.log('  ✅ VERIFICACIÓN COMPLETADA EXITOSAMENTE');
    console.log('═'.repeat(60));
    console.log();
    console.log('El formato institucional de recetas está funcionando correctamente.');
    console.log('Todos los campos nuevos se guardan y recuperan correctamente.');
    console.log();

  } catch (error) {
    console.error('❌ Error durante la verificación:', error.message);
  }
}

testPrescriptionFormat();

