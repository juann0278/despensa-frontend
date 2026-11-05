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
  const [turno, setTurno] = useState('MANANA');
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

    try {
      await fetch(`${API_URL}/api/ventas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: parseFloat(montoVenta),
          turno,
          medioPago,
          nombreCliente: medioPago === 'FIADO' ? nombreCliente.trim() : null,
          descripcion: descripcionVenta
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

    try {
      await fetch(`${API_URL}/api/gastos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: parseFloat(montoGasto),
          tipo: tipoGasto,
          observaciones
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

    try {
      // 1. Borramos el fiado original
      await fetch(`${API_URL}/api/ventas/${ventaFiado.id}`, { method: 'DELETE' });

      // 2. Creamos la venta real con el medio de pago elegido (EFECTIVO o MERCADO_PAGO)
      await fetch(`${API_URL}/api/ventas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: ventaFiado.monto,
          turno: 'MANANA',
          medioPago: metodoPagoFiado,
          nombreCliente: null,
          descripcion: `Pago de fiado de ${ventaFiado.nombreCliente}`
        })
      });

      // Limpiamos el estado de pago
      setFiadoSeleccionadoParaPagar(null);
      setMetodoPagoFiado('EFECTIVO');

      cargarDatosDia();
      cargarDatosMes();
    } catch (error) {
      console.error("Error al saldar el fiado:", error);
    }
  };

  // Función para saldar TODA la cuenta del cliente de una vez
  const confirmarSaldarTodoCliente = async (cliente, ventasDelCliente) => {
    const totalDeuda = ventasDelCliente.reduce((acc, v) => acc + v.monto, 0);
    if (totalDeuda <= 0) return;

    try {
      // 1. Borramos todos los fiados individuales de ese cliente
      for (const v of ventasDelCliente) {
        await fetch(`${API_URL}/api/ventas/${v.id}`, { method: 'DELETE' });
      }

      // 2. Registramos una única venta por el monto total con el medio de pago elegido
      await fetch(`${API_URL}/api/ventas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: totalDeuda,
          turno: 'MANANA',
          medioPago: metodoPagoTodo,
          nombreCliente: null,
          descripcion: `Pago total de cuenta corriente de ${cliente}`
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

  // Cálculos del Día (Excluyendo fiados pendientes)
  const ventasValidasDia = ventasDia.filter(v => v.medioPago !== 'FIADO');
  const totalVentasDia = ventasValidasDia.reduce((acc, item) => acc + item.monto, 0);
  const totalGastosDia = gastosDia.reduce((acc, item) => acc + item.monto, 0);
  const balanceNetoDia = totalVentasDia - totalGastosDia;

  const ventasMañana = ventasValidasDia.filter(v => v.turno === 'MANANA').reduce((acc, v) => acc + v.monto, 0);
  const ventasTarde = ventasValidasDia.filter(v => v.turno === 'TARDE').reduce((acc, v) => acc + v.monto, 0);

  // Desglose por Medio de Pago en el día
  const totalEfectivoDia = ventasValidasDia.filter(v => v.medioPago === 'EFECTIVO').reduce((acc, v) => acc + v.monto, 0);
  const totalMpDia = ventasValidasDia.filter(v => v.medioPago === 'MERCADO_PAGO').reduce((acc, v) => acc + v.monto, 0);

  // Cálculos del Mes
  const ventasValidasMes = ventasMes.filter(v => v.medioPago !== 'FIADO');
  const totalVentasMesVal = ventasValidasMes.reduce((acc, item) => acc + item.monto, 0);
  const totalGastosMesVal = gastosMes.reduce((acc, item) => acc + item.monto, 0);
  const balanceNetoMesVal = totalVentasMesVal - totalGastosMesVal;

  // Agrupar Fiados Pendientes del Mes
  const fiadosPendientes = ventasMes.filter(v => v.medioPago === 'FIADO' && v.nombreCliente);
  const deudasPorCliente = fiadosPendientes.reduce((acc, venta) => {
    const cliente = venta.nombreCliente;
    if (!acc[cliente]) acc[cliente] = [];
    acc[cliente].push(venta);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Cabecera general */}
        <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              🛒 Despensa "Lo de Gonza"
            </h1>
            <p className="text-slate-500 text-sm">Control diario y general del negocio</p>
          </div>

          {/* Selector de Mes Desplegable */}
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="text-sm font-medium text-slate-600">Mes:</label>
            <select 
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
        <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-200 block">📊 Balance General del Mes ({mesFiltro})</span>
            <div className="flex gap-6 mt-2 text-sm">
              <span>Ingresos Reales: <b>${totalVentasMesVal}</b></span>
              <span>Gastos: <b>${totalGastosMesVal}</b></span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-200 block">Ganancia Neta Mensual</span>
            <span className={`text-3xl font-black ${balanceNetoMesVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${balanceNetoMesVal}
            </span>
          </div>
        </div>

        {/* Cuentas Corrientes / Fiados Pendientes */}
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl shadow-sm">
          <h2 className="text-lg font-bold text-amber-900 mb-3 flex items-center gap-2">
            📝 Cuentas Corrientes (Fiados Pendientes del Mes)
          </h2>
          {Object.keys(deudasPorCliente).length === 0 ? (
            <p className="text-sm text-amber-700 italic">No hay clientes con deudas pendientes en este mes.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(deudasPorCliente).map(([cliente, ventas]) => {
                const totalDeudaCliente = ventas.reduce((acc, v) => acc + v.monto, 0);
                return (
                  <div key={cliente} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex flex-col justify-between space-y-3">
                    <div>
                      {/* Cabecera del Cliente con el Botón Pagar Todo */}
                      <div className="flex justify-between items-start mb-2 border-b border-amber-100 pb-2">
                        <div>
                          <span className="font-bold text-slate-800 text-base block">👤 {cliente}</span>
                          <span className="font-black text-rose-600 text-lg">${totalDeudaCliente}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setClienteSeleccionadoParaPagarTodo(cliente);
                            setMetodoPagoTodo('EFECTIVO');
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs transition shadow-sm"
                          title="Saldar toda la cuenta de una vez"
                        >
                          Pagar Todo ⚡
                        </button>
                      </div>

                      {/* Panel desplegable si elige Pagar Todo */}
                      {clienteSeleccionadoParaPagarTodo === cliente && (
                        <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 space-y-2 mb-3">
                          <p className="text-xs font-bold text-indigo-900">Pagar todo (${totalDeudaCliente}):</p>
                          <select 
                            value={metodoPagoTodo}
                            onChange={(e) => setMetodoPagoTodo(e.target.value)}
                            className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-xs font-semibold text-slate-700 outline-none"
                          >
                            <option value="EFECTIVO">Efectivo</option>
                            <option value="MERCADO_PAGO">Mercado Pago</option>
                          </select>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => confirmarSaldarTodoCliente(cliente, ventas)}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 rounded shadow"
                            >
                              Confirmar Pago Total ✓
                            </button>
                            <button 
                              onClick={() => setClienteSeleccionadoParaPagarTodo(null)}
                              className="bg-slate-300 hover:bg-slate-400 text-slate-700 text-xs font-bold px-2 py-1.5 rounded"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Lista de fiados individuales */}
                      <div className="text-xs text-slate-500 space-y-2 max-h-40 overflow-y-auto">
                        {ventas.map((v) => (
                          <div key={v.id} className="bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-slate-700">{v.descripcion || 'Sin detalle'} (<b className="text-slate-900">${v.monto}</b>)</span>
                              <button 
                                onClick={() => {
                                  setFiadoSeleccionadoParaPagar(v);
                                  setMetodoPagoFiado('EFECTIVO');
                                }} 
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-xs transition shadow-sm"
                              >
                                Pagar ✓
                              </button>
                            </div>

                            {/* Panel desplegable de selección de pago individual */}
                            {fiadoSeleccionadoParaPagar && fiadoSeleccionadoParaPagar.id === v.id && (
                              <div className="bg-amber-100/90 p-2 rounded-lg border border-amber-300 space-y-2">
                                <p className="text-[10px] font-bold text-amber-900">¿Cómo abona este?</p>
                                <select 
                                  value={metodoPagoFiado}
                                  onChange={(e) => setMetodoPagoFiado(e.target.value)}
                                  className="w-full bg-white border border-amber-300 rounded px-2 py-0.5 text-xs font-semibold text-slate-700 outline-none"
                                >
                                  <option value="EFECTIVO">Efectivo</option>
                                  <option value="MERCADO_PAGO">Mercado Pago</option>
                                </select>
                                <div className="flex gap-1">
                                  <button 
                                    onClick={confirmarSaldarFiado}
                                    className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold py-1 rounded"
                                  >
                                    Confirmar
                                  </button>
                                  <button 
                                    onClick={() => setFiadoSeleccionadoParaPagar(null)}
                                    className="bg-slate-300 text-slate-700 text-[10px] font-bold px-2 py-1 rounded"
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
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-1 rounded text-center font-medium block">
                      {ventas.length} {ventas.length === 1 ? 'fiado pendiente' : 'fiados pendientes'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cabecera de Fecha y Botón para Ver Estadísticas del Día */}
        <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="text-sm font-medium text-slate-600">Ver Día:</label>
            <input 
              type="date" 
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button 
            onClick={() => setMostrarCierreCaja(!mostrarCierreCaja)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 rounded-xl transition shadow-md shadow-indigo-200 flex items-center gap-2 text-sm"
          >
            📊 {mostrarCierreCaja ? 'Ocultar Estadísticas del Día' : 'Ver Estadísticas del Día'}
          </button>
        </div>

        {/* PANEL DESPLEGABLE: Estadísticas y Cierre del Día */}
        {mostrarCierreCaja && (
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-6 border border-slate-800 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  📈 Cierre y Estadísticas del Día ({fechaFiltro})
                </h3>
                <p className="text-xs text-slate-400">Resumen detallado de ingresos, medios de pago y balances</p>
              </div>
              <button 
                onClick={() => setMostrarCierreCaja(false)}
                className="text-slate-400 hover:text-white text-sm font-bold bg-slate-800 px-3 py-1 rounded-lg"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <span className="text-xs font-bold text-slate-400 uppercase">💵 Efectivo en Caja</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">${totalEfectivoDia}</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <span className="text-xs font-bold text-slate-400 uppercase">📱 Mercado Pago</span>
                <p className="text-2xl font-bold text-sky-400 mt-1">${totalMpDia}</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <span className="text-xs font-bold text-slate-400 uppercase">📉 Total Gastos</span>
                <p className="text-2xl font-bold text-rose-400 mt-1">${totalGastosDia}</p>
              </div>
              <div className={`p-4 rounded-xl border ${balanceNetoDia >= 0 ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-rose-950/40 border-rose-800 text-rose-300'}`}>
                <span className="text-xs font-bold uppercase tracking-wider block opacity-80">Balance Neto del Día</span>
                <p className="text-2xl font-black mt-1">${balanceNetoDia}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div className="bg-slate-800/50 p-4 rounded-xl flex justify-between items-center">
                <span className="text-sm font-medium text-slate-300">☀️ Ventas Turno Mañana:</span>
                <span className="text-lg font-bold text-white">${ventasMañana}</span>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-xl flex justify-between items-center">
                <span className="text-sm font-medium text-slate-300">🌙 Ventas Turno Tarde:</span>
                <span className="text-lg font-bold text-white">${ventasTarde}</span>
              </div>
            </div>
          </div>
        )}

        {/* Formularios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Registrar Venta */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              💰 Registrar Venta
            </h2>
            <form onSubmit={registrarVenta} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Monto ($)</label>
                <input 
                  type="number" 
                  placeholder="Ej: 2500"
                  value={montoVenta}
                  onChange={(e) => setMontoVenta(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Turno</label>
                  <select 
                    value={turno}
                    onChange={(e) => setTurno(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="MANANA">Mañana</option>
                    <option value="TARDE">Tarde</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Medio de Pago</label>
                  <select 
                    value={medioPago}
                    onChange={(e) => setMedioPago(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="MERCADO_PAGO">Mercado Pago</option>
                    <option value="FIADO">Fiado</option>
                  </select>
                </div>
              </div>

              {medioPago === 'FIADO' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Nombre del Cliente (Debe)</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Seba"
                    value={nombreCliente}
                    onChange={(e) => setNombreCliente(e.target.value)}
                    className="w-full border border-amber-300 bg-amber-50 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Descripción (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ej: Pan y Coca"
                  value={descripcionVenta}
                  onChange={(e) => setDescripcionVenta(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition shadow-md shadow-blue-200">
                Guardar Venta
              </button>
            </form>
          </div>

          {/* Registrar Gasto */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              📉 Registrar Gasto
            </h2>
            <form onSubmit={registrarGasto} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Monto ($)</label>
                <input 
                  type="number" 
                  placeholder="Ej: 15000"
                  value={montoGasto}
                  onChange={(e) => setMontoGasto(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de Gasto</label>
                <select 
                  value={tipoGasto}
                  onChange={(e) => setTipoGasto(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-white"
                >
                  <option value="PROVEEDOR">Proveedor</option>
                  <option value="SERVICIOS">Servicios</option>
                  <option value="VARIOS">Varios</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Observaciones</label>
                <input 
                  type="text" 
                  placeholder="Ej: Compra de mercadería"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
              <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl transition shadow-md shadow-rose-200">
                Guardar Gasto
              </button>
            </form>
          </div>

        </div>

        {/* Listados de Movimientos del Día */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
          
          {/* Ventas del día */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-md font-bold text-slate-800 mb-4">Ventas del Día ({fechaFiltro})</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {ventasDia.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No hay ventas registradas en esta fecha.</p>
              ) : (
                ventasDia.map((v) => (
                  <div key={v.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700">${v.monto}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${v.turno === 'MANANA' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {v.turno === 'MANANA' ? 'MAÑANA' : v.turno}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          v.medioPago === 'EFECTIVO' ? 'bg-emerald-100 text-emerald-700' : 
                          v.medioPago === 'MERCADO_PAGO' ? 'bg-sky-100 text-sky-700' : 'bg-amber-200 text-amber-900'
                        }`}>
                          {v.medioPago === 'MERCADO_PAGO' ? 'Mercado Pago' : v.medioPago}
                        </span>
                      </div>
                      {v.medioPago === 'FIADO' && v.nombreCliente && (
                        <p className="text-xs font-bold text-amber-800 mt-1">👤 Fiado a: {v.nombreCliente}</p>
                      )}
                      {v.descripcion && <p className="text-xs text-slate-500 mt-0.5">{v.descripcion}</p>}
                    </div>
                    <button 
                      onClick={() => eliminarVenta(v.id)}
                      className="text-slate-400 hover:text-rose-600 text-sm p-1 transition"
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
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-md font-bold text-slate-800 mb-4">Gastos del Día ({fechaFiltro})</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {gastosDia.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No hay gastos registrados en esta fecha.</p>
              ) : (
                gastosDia.map((g) =>(
                  <div key={g.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-bold text-rose-600">${g.monto}</span>
                      <span className="ml-2 text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold">
                        {g.tipo}
                      </span>
                      {g.observaciones && <p className="text-xs text-slate-500 mt-0.5">{g.observaciones}</p>}
                    </div>
                    <button 
                      onClick={() => eliminarGasto(g.id)}
                      className="text-slate-400 hover:text-rose-600 text-sm p-1 transition"
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