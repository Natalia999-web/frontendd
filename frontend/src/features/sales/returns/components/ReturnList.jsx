import { Eye, Package, Clock, CheckCircle2, XCircle, Calendar, Hash } from 'lucide-react';

const STATUS_CONFIG = {
  'Pendiente':   { icon: Clock,         color: 'amber',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  label: 'Pendiente'   },
  'Aprobada':    { icon: CheckCircle2,  color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Aprobada'    },
  'Reembolsada': { icon: CheckCircle2,  color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Reembolsada' },
  'Rechazada':   { icon: XCircle,       color: 'red',     bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',    label: 'Rechazada'   },
};

const ReturnList = ({ returns, onViewDetails }) => {
  if (!returns || returns.length === 0) return null;

  return (
    <div className="space-y-4">
      {returns.map((item) => {
        const config = STATUS_CONFIG[item.estado] || STATUS_CONFIG['Pendiente'];
        const Icon = config.icon;
        
        return (
          <div
            key={item.id}
            className="group bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden"
          >
            {/* Indicador de estado lateral */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${config.bg.replace('bg-', 'bg-')}`}></div>

            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${config.bg} flex items-center justify-center shadow-inner`}>
                    <Package size={22} className={config.text} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-800 leading-tight group-hover:text-emerald-700 transition-colors">
                      {item.productos?.[0]?.nombre || item.numero}
                    </h4>
                    <div className="flex items-center gap-3 mt-1.5">
                       <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                         <Hash size={10} /> {item.numeroPedido || item.idVenta}
                       </span>
                       <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                       <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                         <Calendar size={10} /> {item.fechaSolicitud}
                       </span>
                    </div>
                  </div>
                </div>
                
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${config.bg} ${config.text} border border-white shadow-sm`}>
                  <Icon size={10} strokeWidth={3} />
                  <span className="text-[9px] font-black uppercase tracking-widest">{config.label}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                 <p className="text-[10px] font-bold text-gray-400 italic line-clamp-1 flex-1 pr-4">
                   "{item.motivo}"
                 </p>
                 <button
                   onClick={() => onViewDetails(item)}
                   className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-emerald-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group/btn shadow-sm"
                 >
                   <Eye size={12} strokeWidth={3} />
                   Ver Detalle
                 </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ReturnList;