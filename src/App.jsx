import React, { useState, useEffect } from 'react';

// Detecta automáticamente si está en la nube (Render) o en tu PC (Localhost)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function App() {
  const [ventasDia, setVentasDia] = useState([]);
  const [gastosDia, setGastosDia] = useState([]);
  
  const [ventasMes, setVentasMes] = useState([]);
  const [gastosMes, setGastosMes] = useState([]);

  // Estado para mostrar u ocultar el panel de estadísticas del día
  const [mostrarCierreCaja, setMostrarCierreCaja] = useState(false);

  // Fechas por defecto
  const hoy = new Date().toISOString().split('T')[0];
  const [fechaFiltro, setFechaFiltro] = useState(hoy);

  // Mes actual por defecto (YYYY-MM)
  const mesActualStr = hoy.substring(0, 7); 
  const [mesFiltro, setMesFiltro] = useState(mesActualStr);

  // Estados formularios de Venta
  const [montoVenta, setMontoVenta] = useState('');
  const [medioPago, setMedioPago] = useState('EFECTIVO');
  const [nombreCliente, setNombreCliente] = useState('');
  const [descripcionVenta, setDescripcionVenta] = useState('');

  // Estados formularios de Gasto
  const [montoGasto, setMontoGasto] = useState('');
  const [tipoGasto, setTipoGasto] = useState('PROVEEDOR');
  const [observaciones, setObservaciones] = useState('');

  // Estado para manejar el pago de fiados individual de forma visual con <select>
  const [fiadoSeleccionadoParaPagar, setFiadoSeleccionadoParaPagar] = useState(null);
  const [metodoPagoFiado, setMetodoPagoFiado] = useState('EFECTIVO');

  // Estados para manejar el pago de TODA LA CUENTA de un cliente
  const [clienteSeleccionadoParaPagarTodo, setClienteSeleccionadoParaPagarTodo] = useState(null);
  const [metodoPagoTodo, setMetodoPagoTodo] = useState('EFECTIVO');

  useEffect(() => {
    cargarDatosDia();
  }, [fechaFiltro]);

  useEffect(() => {
    cargarDatosMes();
  }, [mesFiltro, ventasDia, gastosDia]);

  const cargarDatosDia = async () => {
    try {
      const resVentas = await fetch(`${API_URL}/api/ventas?fecha=${fechaFiltro}`);
      if (resVentas.ok) setVentasDia(await resVentas.json());

      const resGastos = await fetch(`${API_URL}/api/gastos?fecha=${fechaFiltro}`);
      if (resGastos.ok) setGastosDia(await resGastos.json());
    } catch (error) {
      console.error("Error al cargar datos del día:", error);
    }
  };

  const cargarDatosMes = async () => {
    try {
      const [anio, mes] = mesFiltro.split('-');
      const resVentas = await fetch(`${API_URL}/api/ventas/mes?anio=${anio}&mes=${mes}`);
      if (resVentas.ok) setVentasMes(await resVentas.json());

      const resGastos = await fetch(`${API_URL}/api/gastos/mes?anio=${anio}&mes=${mes}`);
      if (resGastos.ok) setGastosMes(await resGastos.json());
    } catch (error) {
      console.error("Error al cargar datos del mes:", error);
    }
  };

  const registrarVenta = async (e) => {
    e.preventDefault();
    if (!montoVenta) return;

    // Respetamos la fecha que Gonzalo tiene seleccionada en el filtro
    const horaActual = new Date().toTimeString().split(' ')[0]; // HH:mm:ss
    const fechaHoraPersonalizada = `${fechaFiltro}T${horaActual}`;

    try {
      await fetch(`${API_URL}/api/ventas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: parseFloat(montoVenta),
          medioPago,
          nombreCliente: medioPago === 'FIADO' ? nombreCliente.trim() : null,
          descripcion: descripcionVenta,
          fechaHora: fechaHoraPersonalizada
        })
      });
      setMontoVenta('');
      setNombreCliente('');
      setDescripcionVenta('');
      setMedioPago('EFECTIVO');
      cargarDatosDia();
      cargarDatosMes();
    } catch (error) {
      console.error("Error al registrar venta:", error);
    }
  };

  const registrarGasto = async (e) => {
    e.preventDefault();
    if (!montoGasto) return;

    const horaActual = new Date().toTimeString().split(' ')[0];
    const fechaHoraPersonalizada = `${fechaFiltro}T${horaActual}`;

    try {
      await fetch(`${API_URL}/api/gastos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: parseFloat(montoGasto),
          tipo: tipoGasto,
          observaciones,
          fechaHora: fechaHoraPersonalizada
        })
      });
      setMontoGasto('');
      setObservaciones('');
      cargarDatosDia();
      cargarDatosMes();
    } catch (error) {
      console.error("Error al registrar gasto:", error);
    }
  };

  const eliminarVenta = async (id) => {
    if (!confirm("¿Seguro querés eliminar esta venta?")) return;
    await fetch(`${API_URL}/api/ventas/${id}`, { method: 'DELETE' });
    cargarDatosDia();
    cargarDatosMes();
  };

  const confirmarSaldarFiado = async () => {
    if (!fiadoSeleccionadoParaPagar) return;

    const ventaFiado = fiadoSeleccionadoParaPagar;
    const horaActual = new Date().toTimeString().split(' ')[0];
    const fechaHoraPersonalizada = `${fechaFiltro}T${horaActual}`;

    try {
      // 1. Borramos el fiado original
      await fetch(`${API_URL}/api/ventas/${ventaFiado.id}`, { method: 'DELETE' });

      // 2. Creamos la venta real con el medio de pago elegido en la fecha seleccionada
      await fetch(`${API_URL}/api/ventas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: ventaFiado.monto,
          medioPago: metodoPagoFiado,
          nombreCliente: null,
          descripcion: `Pago de fiado de ${ventaFiado.nombreCliente}`,
          fechaHora: fechaHoraPersonalizada
        })
      });

      setFiadoSeleccionadoParaPagar(null);
      setMetodoPagoFiado('EFECTIVO');

      cargarDatosDia();
      cargarDatosMes();
    } catch (error) {
      console.error("Error al saldar el fiado:", error);
    }
  };

  const confirmarSaldarTodoCliente = async (cliente, ventasDelCliente) => {
    const totalDeuda = ventasDelCliente.reduce((acc, v) => acc + v.monto, 0);
    if (totalDeuda <= 0) return;

    const horaActual = new Date().toTimeString().split(' ')[0];
    const fechaHoraPersonalizada = `${fechaFiltro}T${horaActual}`;

    try {
      for (const v of ventasDelCliente) {
        await fetch(`${API_URL}/api/ventas/${v.id}`, { method: 'DELETE' });
      }

      await fetch(`${API_URL}/api/ventas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: totalDeuda,
          medioPago: metodoPagoTodo,
          nombreCliente: null,
          descripcion: `Pago total de cuenta corriente de ${cliente}`,
          fechaHora: fechaHoraPersonalizada
        })
      });

      setClienteSeleccionadoParaPagarTodo(null);
      setMetodoPagoTodo('EFECTIVO');
      cargarDatosDia();
      cargarDatosMes();
    } catch (error) {
      console.error("Error al saldar toda la cuenta:", error);
    }
  };

  const eliminarGasto = async (id) => {
    if (!confirm("¿Seguro querés eliminar este gasto?")) return;
    await fetch(`${API_URL}/api/gastos/${id}`, { method: 'DELETE' });
    cargarDatosDia();
    cargarDatosMes();
  };

  // Cálculos del Día
  const ventasValidasDia = ventasDia.filter(v => v.medioPago !== 'FIADO');
  const totalVentasDia = ventasValidasDia.reduce((acc, item) => acc + item.monto, 0);
  const totalGastosDia = gastosDia.reduce((acc, item) => acc + item.monto, 0);
  const balanceNetoDia = totalVentasDia - totalGastosDia;

  const totalEfectivoDia = ventasValidasDia.filter(v => v.medioPago === 'EFECTIVO').reduce((acc, v) => acc + v.monto, 0);
  const totalMpDia = ventasValidasDia.filter(v => v.medioPago === 'MERCADO_PAGO').reduce((acc, v) => acc + v.monto, 0);

  // Cálculos del Mes
  const ventasValidasMes = ventasMes.filter(v => v.medioPago !== 'FIADO');
  const totalVentasMesVal = ventasValidasMes.reduce((acc, item) => acc + item.monto, 0);
  const totalGastosMesVal = gastosMes.reduce((acc, item) => acc + item.monto, 0);
  const balanceNetoMesVal = totalVentasMesVal - totalGastosMesVal;

  const fiadosPendientes = ventasMes.filter(v => v.medioPago === 'FIADO' && v.nombreCliente);
  const deudasPorCliente = fiadosPendientes.reduce((acc, venta) => {
    const cliente = venta.nombreCliente;
    if (!acc[cliente]) acc[cliente] = [];
    acc[cliente].push(venta);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-4 md:p-8 font-sans text-stone-800">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Cabecera general */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#5c3a21] shadow-md bg-[#5c3a21] flex items-center justify-center shrink-0">
              <img 
                src="/logo-gonza.jpeg" 
                alt="Lo de Gonza" 
                className="w-full h-full object-cover"
                onError={(e)=>{e.target.style.display='none'}}
              />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#3d2514] tracking-tight flex items-center gap-2">
                Despensa <span className="text-[#c28e2c]">"Lo de Gonza"</span>
              </h1>
              <p className="text-stone-500 text-sm font-medium">Control diario y general del negocio</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200 shadow-inner">
            <label className="text-sm font-bold text-stone-600">Mes:</label>
            <select 
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="bg-white border border-stone-300 rounded-xl px-3 py-2 text-sm font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#5c3a21] cursor-pointer"
            >
              <option value="2026-01">Enero 2026</option>
              <option value="2026-02">Febrero 2026</option>
              <option value="2026-03">Marzo 2026</option>
              <option value="2026-04">Abril 2026</option>
              <option value="2026-05">Mayo 2026</option>
              <option value="2026-06">Junio 2026</option>
              <option value="2026-07">Julio 2026</option>
              <option value="2026-08">Agosto 2026</option>
              <option value="2026-09">Septiembre 2026</option>
              <option value="2026-10">Octubre 2026</option>
              <option value="2026-11">Noviembre 2026</option>
              <option value="2026-12">Diciembre 2026</option>
            </select>
          </div>
        </div>

        {/* Panel Resumen del Mes */}
        <div className="bg-gradient-to-r from-[#3d2514] to-[#5c3a21] text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4 border border-[#72492d]">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-200/80 block">📊 Balance General del Mes ({mesFiltro})</span>
            <div className="flex gap-6 mt-2 text-sm">
              <span>Ingresos Reales: <b className="text-amber-300">${totalVentasMesVal}</b></span>
              <span>Gastos: <b className="text-amber-300">${totalGastosMesVal}</b></span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-200/80 block">Ganancia Neta Mensual</span>
            <span className={`text-3xl font-black ${balanceNetoMesVal >= 0 ? 'text-amber-300' : 'text-rose-300'}`}>
              ${balanceNetoMesVal}
            </span>
          </div>
        </div>

        {/* Cuentas Corrientes / Fiados Pendientes */}
        <div className="bg-amber-50/70 border border-amber-200/80 p-6 rounded-3xl shadow-sm">
          <h2 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
            📝 Cuentas Corrientes (Fiados Pendientes del Mes)
          </h2>
          {Object.keys(deudasPorCliente).length === 0 ? (
            <p className="text-sm text-amber-800 italic">No hay clientes con deudas pendientes en este mes.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(deudasPorCliente).map(([cliente, ventas]) => {
                const totalDeudaCliente = ventas.reduce((acc, v) => acc + v.monto, 0);
                return (
                  <div key={cliente} className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-sm flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex justify-between items-start mb-3 border-b border-amber-100 pb-2">
                        <div>
                          <span className="font-bold text-stone-800 text-base block">👤 {cliente}</span>
                          <span className="font-black text-rose-600 text-lg">${totalDeudaCliente}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setClienteSeleccionadoParaPagarTodo(cliente);
                            setMetodoPagoTodo('EFECTIVO');
                          }}
                          className="bg-[#5c3a21] hover:bg-[#3d2514] text-white font-bold px-3 py-1.5 rounded-xl text-xs transition shadow-sm"
                        >
                          Pagar Todo ⚡
                        </button>
                      </div>

                      {clienteSeleccionadoParaPagarTodo === cliente && (
                        <div className="bg-amber-100/90 p-3 rounded-2xl border border-amber-300 space-y-2 mb-3">
                          <p className="text-xs font-bold text-amber-900">Pagar todo (${totalDeudaCliente}):</p>
                          <select 
                            value={metodoPagoTodo}
                            onChange={(e) => setMetodoPagoTodo(e.target.value)}
                            className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-stone-700 outline-none"
                          >
                            <option value="EFECTIVO">Efectivo</option>
                            <option value="MERCADO_PAGO">Mercado Pago</option>
                          </select>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => confirmarSaldarTodoCliente(cliente, ventas)}
                              className="flex-1 bg-[#5c3a21] hover:bg-[#3d2514] text-white text-xs font-bold py-1.5 rounded-xl shadow"
                            >
                              Confirmar Pago Total ✓
                            </button>
                            <button 
                              onClick={() => setClienteSeleccionadoParaPagarTodo(null)}
                              className="bg-stone-300 hover:bg-stone-400 text-stone-700 text-xs font-bold px-3 py-1.5 rounded-xl"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-stone-500 space-y-2 max-h-40 overflow-y-auto pr-1">
                        {ventas.map((v) => (
                          <div key={v.id} className="bg-stone-50/80 p-2.5 rounded-xl border border-stone-200/60 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-stone-700">{v.descripcion || 'Sin detalle'} (<b className="text-stone-900">${v.monto}</b>)</span>
                              <button 
                                onClick={() => {
                                  setFiadoSeleccionadoParaPagar(v);
                                  setMetodoPagoFiado('EFECTIVO');
                                }} 
                                className="bg-[#5c3a21] hover:bg-[#3d2514] text-white font-bold px-2.5 py-1 rounded-lg text-xs transition shadow-sm"
                              >
                                Pagar ✓
                              </button>
                            </div>

                            {fiadoSeleccionadoParaPagar && fiadoSeleccionadoParaPagar.id === v.id && (
                              <div className="bg-amber-100 p-2.5 rounded-xl border border-amber-300 space-y-2">
                                <p className="text-[10px] font-bold text-amber-900">¿Cómo abona este?</p>
                                <select 
                                  value={metodoPagoFiado}
                                  onChange={(e) => setMetodoPagoFiado(e.target.value)}
                                  className="w-full bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-semibold text-stone-700 outline-none"
                                >
                                  <option value="EFECTIVO">Efectivo</option>
                                  <option value="MERCADO_PAGO">Mercado Pago</option>
                                </select>
                                <div className="flex gap-1.5">
                                  <button 
                                    onClick={confirmarSaldarFiado}
                                    className="flex-1 bg-[#5c3a21] hover:bg-[#3d2514] text-white text-[10px] font-bold py-1 rounded-lg"
                                  >
                                    Confirmar
                                  </button>
                                  <button 
                                    onClick={() => setFiadoSeleccionadoParaPagar(null)}
                                    className="bg-stone-300 text-stone-700 text-[10px] font-bold px-2.5 py-1 rounded-lg"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] text-amber-800 bg-amber-100/80 px-2 py-1 rounded-lg text-center font-bold block">
                      {ventas.length} {ventas.length === 1 ? 'fiado pendiente' : 'fiados pendientes'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cabecera de Fecha y Botón para Ver Estadísticas del Día */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200 shadow-inner">
            <label className="text-sm font-bold text-stone-600">Ver Día:</label>
            <input 
              type="date" 
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              className="bg-white border border-stone-300 rounded-xl px-3 py-2 text-sm font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#5c3a21]"
            />
          </div>

          <button 
            onClick={() => setMostrarCierreCaja(!mostrarCierreCaja)}
            className="bg-[#5c3a21] hover:bg-[#3d2514] text-white font-bold px-6 py-3 rounded-2xl transition shadow-md flex items-center gap-2 text-sm"
          >
            📊 {mostrarCierreCaja ? 'Ocultar Estadísticas del Día' : 'Ver Estadísticas del Día'}
          </button>
        </div>

        {/* PANEL DESPLEGABLE: Estadísticas y Cierre del Día */}
        {mostrarCierreCaja && (
          <div className="bg-[#2a190e] text-white p-6 md:p-8 rounded-3xl shadow-xl space-y-6 border border-[#5c3a21] animate-fadeIn">
            <div className="flex justify-between items-center border-b border-[#5c3a21] pb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-amber-100">
                  📈 Cierre y Estadísticas del Día ({fechaFiltro})
                </h3>
                <p className="text-xs text-stone-400">Resumen detallado de ingresos, medios de pago y balances</p>
              </div>
              <button 
                onClick={() => setMostrarCierreCaja(false)}
                className="text-stone-400 hover:text-white text-sm font-bold bg-[#3d2514] px-3 py-1.5 rounded-xl"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#3d2514] p-4 rounded-2xl border border-[#5c3a21]">
                <span className="text-xs font-bold text-amber-200 uppercase">💵 Efectivo en Caja</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">${totalEfectivoDia}</p>
              </div>
              <div className="bg-[#3d2514] p-4 rounded-2xl border border-[#5c3a21]">
                <span className="text-xs font-bold text-amber-200 uppercase">📱 Mercado Pago</span>
                <p className="text-2xl font-bold text-amber-300 mt-1">${totalMpDia}</p>
              </div>
              <div className="bg-[#3d2514] p-4 rounded-2xl border border-[#5c3a21]">
                <span className="text-xs font-bold text-amber-200 uppercase">📉 Total Gastos</span>
                <p className="text-2xl font-bold text-rose-300 mt-1">${totalGastosDia}</p>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border ${balanceNetoDia >= 0 ? 'bg-[#3d2514] border-amber-600/50 text-amber-200' : 'bg-rose-950/50 border-rose-800 text-rose-300'}`}>
              <span className="text-xs font-bold uppercase tracking-wider block opacity-80">Balance Neto del Día</span>
              <p className="text-2xl font-black mt-1">${balanceNetoDia}</p>
            </div>
          </div>
        )}

        {/* Formularios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Registrar Venta */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
            <h2 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
              💰 Registrar Venta <span className="text-xs font-normal text-stone-500">(para el día {fechaFiltro})</span>
            </h2>
            <form onSubmit={registrarVenta} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Monto ($)</label>
                <input 
                  type="number" 
                  placeholder="Ej: 2500"
                  value={montoVenta}
                  onChange={(e) => setMontoVenta(e.target.value)}
                  className="w-full border border-stone-300 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-[#5c3a21] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Medio de Pago</label>
                <select 
                  value={medioPago}
                  onChange={(e) => setMedioPago(e.target.value)}
                  className="w-full border border-stone-300 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-[#5c3a21] outline-none bg-white font-medium"
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="MERCADO_PAGO">Mercado Pago</option>
                  <option value="FIADO">Fiado</option>
                </select>
              </div>

              {medioPago === 'FIADO' && (
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1">Nombre del Cliente (Debe)</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Seba"
                    value={nombreCliente}
                    onChange={(e) => setNombreCliente(e.target.value)}
                    className="w-full border border-amber-300 bg-amber-50/50 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Descripción (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ej: Pan y Coca"
                  value={descripcionVenta}
                  onChange={(e) => setDescripcionVenta(e.target.value)}
                  className="w-full border border-stone-300 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-[#5c3a21] outline-none"
                />
              </div>
              <button type="submit" className="w-full bg-[#5c3a21] hover:bg-[#3d2514] text-white font-bold py-3 rounded-2xl transition shadow-md">
                Guardar Venta
              </button>
            </form>
          </div>

          {/* Registrar Gasto */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
            <h2 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
              📉 Registrar Gasto <span className="text-xs font-normal text-stone-500">(para el día {fechaFiltro})</span>
            </h2>
            <form onSubmit={registrarGasto} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Monto ($)</label>
                <input 
                  type="number" 
                  placeholder="Ej: 15000"
                  value={montoGasto}
                  onChange={(e) => setMontoGasto(e.target.value)}
                  className="w-full border border-stone-300 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-[#72492d] outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Tipo de Gasto</label>
                <select 
                  value={tipoGasto}
                  onChange={(e) => setTipoGasto(e.target.value)}
                  className="w-full border border-stone-300 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-[#72492d] outline-none bg-white font-medium"
                >
                  <option value="PROVEEDOR">Proveedor</option>
                  <option value="SERVICIOS">Servicios</option>
                  <option value="VARIOS">Varios</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Observaciones</label>
                <input 
                  type="text" 
                  placeholder="Ej: Compra de mercadería"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full border border-stone-300 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-[#72492d] outline-none"
                />
              </div>
              <button type="submit" className="w-full bg-[#72492d] hover:bg-[#5c3a21] text-white font-bold py-3 rounded-2xl transition shadow-md">
                Guardar Gasto
              </button>
            </form>
          </div>

        </div>

        {/* Listados de Movimientos del Día */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
          
          {/* Ventas del día */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
            <h3 className="text-md font-bold text-stone-800 mb-4">Ventas del Día ({fechaFiltro})</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {ventasDia.length === 0 ? (
                <p className="text-sm text-stone-400 italic">No hay ventas registradas en esta fecha.</p>
              ) : (
                ventasDia.map((v) => (
                  <div key={v.id} className="flex justify-between items-center p-3 bg-stone-50 rounded-2xl border border-stone-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-700">${v.monto}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-lg font-semibold ${
                          v.medioPago === 'EFECTIVO' ? 'bg-emerald-100 text-emerald-800' : 
                          v.medioPago === 'MERCADO_PAGO' ? 'bg-amber-100 text-amber-800' : 'bg-amber-200 text-amber-900'
                        }`}>
                          {v.medioPago === 'MERCADO_PAGO' ? 'Mercado Pago' : v.medioPago}
                        </span>
                      </div>
                      {v.medioPago === 'FIADO' && v.nombreCliente && (
                        <p className="text-xs font-bold text-amber-800 mt-1">👤 Fiado a: {v.nombreCliente}</p>
                      )}
                      {v.descripcion && <p className="text-xs text-stone-500 mt-0.5">{v.descripcion}</p>}
                    </div>
                    <button 
                      onClick={() => eliminarVenta(v.id)}
                      className="text-stone-400 hover:text-rose-600 text-sm p-2 transition rounded-xl hover:bg-rose-50"
                      title="Eliminar venta"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Gastos del día */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
            <h3 className="text-md font-bold text-stone-800 mb-4">Gastos del Día ({fechaFiltro})</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {gastosDia.length === 0 ? (
                <p className="text-sm text-stone-400 italic">No hay gastos registrados en esta fecha.</p>
              ) : (
                gastosDia.map((g) => (
                  <div key={g.id} className="flex justify-between items-center p-3 bg-stone-50 rounded-2xl border border-stone-100">
                    <div>
                      <span className="font-bold text-[#72492d]">${g.monto}</span>
                      <span className="ml-2 text-xs bg-stone-200 text-stone-700 px-2 py-0.5 rounded-lg font-semibold">
                        {g.tipo}
                      </span>
                      {g.observaciones && <p className="text-xs text-stone-500 mt-0.5">{g.observaciones}</p>}
                    </div>
                    <button 
                      onClick={() => eliminarGasto(g.id)}
                      className="text-stone-400 hover:text-rose-600 text-sm p-2 transition rounded-xl hover:bg-rose-50"
                      title="Eliminar gasto"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

export default App;