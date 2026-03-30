const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/inventario/todos',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const inventario = JSON.parse(data);
      const elemento3 = inventario.find(e => e.codigo_elemento === '3');
      
      if (elemento3) {
        console.log('\n✅ ELEMENTO 3 ENCONTRADO:');
        console.log(`   Nombre: ${elemento3.elemento}`);
        console.log(`   Inicial: ${elemento3.cantidad}`);
        console.log(`   Entrada: ${elemento3.entrada}`);
        console.log(`   Devoluciones: ${elemento3.devolucion}`);
        console.log(`   Despachado: ${elemento3.despachado}`);
        console.log(`   Stock Disponible: ${elemento3.stock_disponible}`);
      } else {
        console.log('\n❌ ELEMENTO 3 NO ENCONTRADO');
        console.log(`Total elementos en API: ${inventario.length}`);
        console.log('Primeros 5 elementos:');
        inventario.slice(0, 5).forEach(e => {
          console.log(`  - ${e.codigo_elemento}: ${e.elemento} (stock=${e.stock_disponible})`);
        });
      }
    } catch (error) {
      console.error('Error parsing JSON:', error);
      console.log('Raw response:', data.substring(0, 200));
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.end();
