import { useState, useRef, useEffect } from 'react';
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  DragOverlay, 
  type DragStartEvent, 
  type DragEndEvent 
} from '@dnd-kit/core';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { Pallet, Truck } from './types';

const SCALE = 0.85; 
const ESCAPE_THRESHOLD_PX = 80; 
const SNAP_THRESHOLD_CM = 15; 
const CURSOR_SNAP_CM = 10; 

const INITIAL_TEMPLATES = [
  { id: 'euro', name: 'EURO', width: 120, height: 80 },
  { id: 'euro_rot', name: 'EURO ↕', width: 80, height: 120 },
  { id: 'ind', name: 'Průmysl', width: 120, height: 100 },
  { id: 'ind_rot', name: 'Průmysl ↕', width: 100, height: 120 },
  { id: 'atyp140', name: 'Atyp 140', width: 140, height: 100 },
  { id: 'atyp140_rot', name: 'Atyp 140 ↕', width: 100, height: 140 },
];

// Přidali jsme parametr "splitAt" pro určení, kde se auto láme (v cm)
const INITIAL_TRUCK_TYPES = [
  { id: 'kamion', name: 'Kamion', width: 1360, height: 248 },
  { id: 'souprava', name: 'Souprava (7.7m + 7.7m)', width: 1540, height: 240, splitAt: 770 },
  { id: 'vlek', name: 'Vlek (7.4m + 8.2m)', width: 1560, height: 240, splitAt: 740 },
  { id: '21pal', name: '21-ti paletové auto', width: 840, height: 240 },
  { id: '20pal', name: '20-ti paletové auto', width: 820, height: 240 },
  { id: '18pal', name: '18-ti paletové auto', width: 720, height: 240 },
  { id: 'jarda', name: 'Jardovo auto', width: 600, height: 240 },
];

const DEFAULT_CUSTOMERS = [
  { id: 'c1', name: 'Zákazník A', color: '#16A085' }, 
  { id: 'c2', name: 'Zákazník B', color: '#D35400' }, 
  { id: 'c3', name: 'Zákazník C', color: '#2980B9' }, 
];

const MORE_COLORS = [
  '#F1C40F', '#E74C3C', '#8E44AD', '#00FF00', '#FF69B4', '#34495E', '#8B4513', '#00CED1',
];

function TemplateItem({ template, currentColor, onDelete }: { template: typeof INITIAL_TEMPLATES[0], currentColor: string, onDelete?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tpl-${template.id}`,
    data: { isTemplate: true, ...template, color: currentColor }
  });

  return (
    <div className="relative group">
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={`flex flex-col items-center justify-center cursor-grab transition-all hover:scale-105 ${isDragging ? 'opacity-40' : 'opacity-100'}`}
      >
        <div 
          className="border-2 border-black/30 shadow-md flex items-center justify-center mb-2 transition-colors duration-300"
          style={{ 
            backgroundColor: currentColor, 
            width: template.width * SCALE, 
            height: template.height * SCALE 
          }}
        >
          <span className="text-[10px] font-black text-white uppercase drop-shadow-md text-center leading-tight">
            {template.name}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">
          {template.width}×{template.height}
        </span>
      </div>
      
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(template.id);
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 cursor-pointer border border-white/20"
        >
          ✕
        </button>
      )}
    </div>
  );
}

interface DraggablePalletProps {
  pallet: Pallet;
  truck: Truck;
  onRemove: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

function DraggablePallet({ pallet, truck, onRemove, onContextMenu }: DraggablePalletProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(pallet.id),
    data: { isTemplate: false }
  });

  let rawX = (pallet.position.x * SCALE) + (transform ? transform.x : 0);
  let rawY = (pallet.position.y * SCALE) + (transform ? transform.y : 0);

  const maxX = (truck.width - pallet.width) * SCALE;
  const maxY = (truck.height - pallet.height) * SCALE;

  if (rawX < 0 && rawX >= -ESCAPE_THRESHOLD_PX) rawX = 0;
  else if (rawX > maxX && rawX <= maxX + ESCAPE_THRESHOLD_PX) rawX = maxX;

  if (rawY < 0 && rawY >= -ESCAPE_THRESHOLD_PX) rawY = 0;
  else if (rawY > maxY && rawY <= maxY + ESCAPE_THRESHOLD_PX) rawY = maxY;

  const style = {
    width: pallet.width * SCALE,
    height: pallet.height * SCALE,
    left: 0,
    top: 0,
    transform: `translate3d(${rawX}px, ${rawY}px, 0)`,
    backgroundColor: pallet.color, 
    zIndex: isDragging ? 50 : 10,
    boxShadow: isDragging ? '0 20px 25px -5px rgb(0 0 0 / 0.5)' : '0 4px 6px -1px rgb(0 0 0 / 0.3)',
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onContextMenu={(e) => onContextMenu(e, pallet.id)}
      className="group absolute border-2 border-black/20 flex flex-col items-center justify-center cursor-move transition-[box-shadow,opacity] rounded-sm"
    >
      <span className="text-[10px] font-black text-white uppercase drop-shadow-md leading-none tracking-wider pointer-events-none px-1 text-center truncate w-full">
        {pallet.name}
      </span>
      <span className="text-[8px] text-white/90 font-bold mt-0.5 pointer-events-none">
        {pallet.width}×{pallet.height}
      </span>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(pallet.id)}
        className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 cursor-pointer border border-white/20"
        data-html2canvas-ignore="true"
      >
        ✕
      </button>
    </div>
  );
}

function App() {
  const [truckTypes, setTruckTypes] = useState(INITIAL_TRUCK_TYPES);
  const [truck, setTruck] = useState<any>(INITIAL_TRUCK_TYPES[0]);
  
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [templates, setTemplates] = useState(INITIAL_TEMPLATES);
  
  const [customers, setCustomers] = useState(DEFAULT_CUSTOMERS);
  const [activeCustomerId, setActiveCustomerId] = useState(DEFAULT_CUSTOMERS[0].id);
  const [customerMenu, setCustomerMenu] = useState<{ x: number, y: number, customerId: string } | null>(null);

  // Stavy pro vlastní paletu
  const [customW, setCustomW] = useState<number | ''>('');
  const [customH, setCustomH] = useState<number | ''>('');

  // Stavy pro vlastní (atyp) kamion
  const [customTruckW, setCustomTruckW] = useState<number | ''>('');
  const [customTruckH, setCustomTruckH] = useState<number | ''>('');

  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [preventOverlap, setPreventOverlap] = useState(true);
  const [enableSnap, setEnableSnap] = useState(true);
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, palletId: string } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number, y: number, remX: number, remY: number } | null>(null);

  const { setNodeRef: setTruckRef } = useDroppable({ id: 'truck-board' });
  const printAreaRef = useRef<HTMLDivElement>(null);

  const activeColor = customers.find(c => c.id === activeCustomerId)?.color || '#95a5a6';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setCustomerMenu(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, palletId: id });
    setCustomerMenu(null);
  };

  const handleCustomerContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setCustomerMenu({ x: e.clientX, y: e.clientY, customerId: id });
    setContextMenu(null);
  };

  const handleRotate = (id: string) => {
    setPallets(prev => prev.map(p => {
      if (p.id !== id) return p;
      const newWidth = p.height;
      const newHeight = p.width;
      const clampedX = Math.min(p.position.x, truck.width - newWidth);
      const clampedY = Math.min(p.position.y, truck.height - newHeight);
      return { ...p, width: newWidth, height: newHeight, position: { x: Math.max(0, clampedX), y: Math.max(0, clampedY) } };
    }));
  };

  const handleRename = (id: string) => {
    const pallet = pallets.find(p => p.id === id);
    if (!pallet) return;
    const newName = window.prompt('Zadej nový název palety:', pallet.name);
    if (newName !== null && newName.trim() !== '') {
      setPallets(prev => prev.map(p => p.id === id ? { ...p, name: newName.trim() } : p));
    }
  };

  const handleRenameCustomer = (id: string) => {
    const customer = customers.find(c => c.id === id);
    if (!customer) return;
    const newName = window.prompt('Zadej nový název zákazníka:', customer.name);
    if (newName !== null && newName.trim() !== '') {
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, name: newName.trim() } : c));
    }
  };

  const handleAddCustomer = () => {
    const newId = `c${Date.now()}`;
    const colorIndex = Math.max(0, customers.length - 3) % MORE_COLORS.length;
    const nextColor = MORE_COLORS[colorIndex];
    setCustomers(prev => [...prev, { id: newId, name: `Zákazník ${String.fromCharCode(65 + customers.length)}`, color: nextColor }]);
  };

  const handleAddCustomTemplate = () => {
    if (customW && customH) {
      const newTemplate = {
        id: `custom-${Date.now()}`,
        name: `Atyp ${customW}x${customH}`,
        width: Number(customW),
        height: Number(customH),
      };
      setTemplates(prev => [...prev, newTemplate]);
      setCustomW(''); 
      setCustomH('');
    }
  };

  const handleAddCustomTruck = () => {
    if (customTruckW && customTruckH) {
      const newTruck = {
        id: `truck-${Date.now()}`,
        name: `Atyp vůz (${customTruckW}x${customTruckH})`,
        width: Number(customTruckW),
        height: Number(customTruckH),
      };
      setTruckTypes(prev => [...prev, newTruck]);
      setTruck(newTruck); // Okamžitě ho přepneme
      setPallets([]); // Nové auto = čistá plocha
      setCustomTruckW(''); 
      setCustomTruckH('');
    }
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    let xCm = Math.round(xPx / SCALE);
    let yCm = Math.round(yPx / SCALE);

    let snappedX = xCm;
    let closestDist = CURSOR_SNAP_CM;

    pallets.forEach(p => {
      const rightEdge = p.position.x + p.width;
      if (Math.abs(xCm - rightEdge) < closestDist) {
        snappedX = rightEdge;
        closestDist = Math.abs(xCm - rightEdge);
      }
      const leftEdge = p.position.x;
      if (Math.abs(xCm - leftEdge) < closestDist) {
        snappedX = leftEdge;
        closestDist = Math.abs(xCm - leftEdge);
      }
    });

    xCm = snappedX;
    
    xCm = Math.max(0, Math.min(xCm, truck.width));
    yCm = Math.max(0, Math.min(yCm, truck.height));

    setCursorPos({
      x: xCm,
      y: yCm,
      remX: Math.round((truck.width - xCm) * 10) / 10,
      remY: Math.round((truck.height - yCm) * 10) / 10
    });
  };

  const checkCollision = (newX: number, newY: number, width: number, height: number, ignoreId: string | null = null) => {
    return pallets.some((p) => {
      if (p.id === ignoreId) return false; 
      return (
        newX < p.position.x + p.width &&
        newX + width > p.position.x &&
        newY < p.position.y + p.height &&
        newY + height > p.position.y
      );
    });
  };

  const applySnapping = (x: number, y: number, w: number, h: number, ignoreId: string | null = null) => {
    let snappedX = x;
    let snappedY = y;

    pallets.forEach(p => {
      if (p.id === ignoreId) return;

      if (Math.abs((x + w) - p.position.x) < SNAP_THRESHOLD_CM) snappedX = p.position.x - w;
      else if (Math.abs(x - (p.position.x + p.width)) < SNAP_THRESHOLD_CM) snappedX = p.position.x + p.width;
      else if (Math.abs(x - p.position.x) < SNAP_THRESHOLD_CM) snappedX = p.position.x; 

      if (Math.abs((y + h) - p.position.y) < SNAP_THRESHOLD_CM) snappedY = p.position.y - h;
      else if (Math.abs(y - (p.position.y + p.height)) < SNAP_THRESHOLD_CM) snappedY = p.position.y + p.height;
      else if (Math.abs(y - p.position.y) < SNAP_THRESHOLD_CM) snappedY = p.position.y; 
    });

    return { x: Number(snappedX.toFixed(1)), y: Number(snappedY.toFixed(1)) };
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.isTemplate) {
      setActiveTemplate(active.data.current);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    setActiveTemplate(null);

    const THRESHOLD_CM = ESCAPE_THRESHOLD_PX / SCALE;

    if (active.data.current?.isTemplate) {
      const truckEl = document.getElementById('truck-board');
      if (!truckEl) return;

      const truckRect = truckEl.getBoundingClientRect();
      const itemRect = active.rect.current.translated;

      if (itemRect) {
        const itemWidth = active.data.current.width * SCALE;
        const itemHeight = active.data.current.height * SCALE;
        const centerX = itemRect.left + itemWidth / 2;
        const centerY = itemRect.top + itemHeight / 2;

        if (
          centerX >= truckRect.left &&
          centerX <= truckRect.right &&
          centerY >= truckRect.top &&
          centerY <= truckRect.bottom
        ) {
          let dropX = (itemRect.left - truckRect.left) / SCALE;
          let dropY = (itemRect.top - truckRect.top) / SCALE;

          if (enableSnap) {
            const snapped = applySnapping(dropX, dropY, active.data.current.width, active.data.current.height);
            dropX = snapped.x;
            dropY = snapped.y;
          }

          const maxX_cm = truck.width - active.data.current.width;
          const maxY_cm = truck.height - active.data.current.height;

          if (dropX < 0 && dropX >= -THRESHOLD_CM) dropX = 0;
          else if (dropX > maxX_cm && dropX <= maxX_cm + THRESHOLD_CM) dropX = maxX_cm;

          if (dropY < 0 && dropY >= -THRESHOLD_CM) dropY = 0;
          else if (dropY > maxY_cm && dropY <= maxY_cm + THRESHOLD_CM) dropY = maxY_cm;

          if (preventOverlap && checkCollision(dropX, dropY, active.data.current.width, active.data.current.height)) {
            return; 
          }

          const newPallet: Pallet = {
            id: Date.now().toString(),
            name: active.data.current.name,
            width: active.data.current.width,
            height: active.data.current.height,
            color: active.data.current.color, 
            position: { x: dropX, y: dropY },
          };
          setPallets((prev) => [...prev, newPallet]);
        }
      }
      return;
    }

    const draggedPallet = pallets.find((p) => String(p.id) === String(active.id));
    if (!draggedPallet) return;

    let newX = draggedPallet.position.x + (delta.x / SCALE);
    let newY = draggedPallet.position.y + (delta.y / SCALE);

    if (enableSnap) {
      const snapped = applySnapping(newX, newY, draggedPallet.width, draggedPallet.height, draggedPallet.id);
      newX = snapped.x;
      newY = snapped.y;
    }

    const maxX_cm = truck.width - draggedPallet.width;
    const maxY_cm = truck.height - draggedPallet.height;

    if (newX < 0 && newX >= -THRESHOLD_CM) newX = 0;
    else if (newX > maxX_cm && newX <= maxX_cm + THRESHOLD_CM) newX = maxX_cm;

    if (newY < 0 && newY >= -THRESHOLD_CM) newY = 0;
    else if (newY > maxY_cm && newY <= maxY_cm + THRESHOLD_CM) newY = maxY_cm;

    if (preventOverlap && checkCollision(newX, newY, draggedPallet.width, draggedPallet.height, draggedPallet.id)) {
      return; 
    }

    setPallets((prev) => 
      prev.map((p) => {
        if (String(p.id) === String(active.id)) {
          return { ...p, position: { x: newX, y: newY } };
        }
        return p;
      })
    );
  };

  const removePallet = (idToRemove: string) => {
    setPallets((prev) => prev.filter((p) => p.id !== idToRemove));
  };

  const clearAllPallets = () => {
    if (window.confirm('Opravdu chcete z kamionu vymazat všechny palety?')) {
      setPallets([]);
    }
  };

  const handleTruckChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedTruck = truckTypes.find(t => t.id === selectedId);
    if (selectedTruck) {
      setTruck(selectedTruck as any);
      setPallets([]);
    }
  };

  const handleExportPDF = async () => {
    if (!printAreaRef.current) return;
    try {
      const dataUrl = await toPng(printAreaRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#1e293b',
        filter: (node) => {
          if (node instanceof HTMLElement && node.dataset.html2canvasIgnore === 'true') {
            return false;
          }
          return true;
        }
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (printAreaRef.current.offsetHeight * pdfWidth) / printAreaRef.current.offsetWidth;

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`plan-nakladky-${dateStr}.pdf`);
    } catch (error) {
      console.error('Chyba při generování PDF:', error);
      alert('Jejda, PDF se nepovedlo vytvořit.');
    }
  };

  const currentRemX = cursorPos ? cursorPos.remX : truck.width;
  const euroHorizontalCount = Math.floor(currentRemX / 120);
  const euroVerticalCount = Math.floor(currentRemX / 80);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans flex flex-col selection:bg-blue-500/30">
      <header className="bg-slate-950 border-b border-slate-800 px-8 py-5 flex justify-between items-center shadow-lg z-20 relative">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
            <span className="text-xl font-black text-white">L</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight leading-none">
              LOGI-PLANER <span className="text-blue-500">v2.0</span>
            </h1>
          </div>
        </div>
      </header>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        
        <div className="bg-slate-900 border-b border-slate-700 p-6 flex justify-center items-stretch flex-wrap gap-6 shadow-2xl relative z-10" data-html2canvas-ignore="true">
          
          {/* ZÁKAZNÍCI */}
          <div className="flex flex-col gap-1 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 min-w-[150px]">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Zákazníci</span>
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[100px] pr-2 scrollbar-thin scrollbar-thumb-slate-600">
              {customers.map(c => (
                <label 
                  key={c.id} 
                  onContextMenu={(e) => handleCustomerContextMenu(e, c.id)}
                  className="flex items-center gap-2 cursor-pointer text-sm text-slate-200 hover:text-white transition-colors group"
                >
                  <input 
                    type="radio" 
                    name="customer" 
                    className="hidden" 
                    checked={activeCustomerId === c.id}
                    onChange={() => setActiveCustomerId(c.id)}
                  />
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 ${activeCustomerId === c.id ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c.color }}>
                    {activeCustomerId === c.id && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <span className={activeCustomerId === c.id ? 'font-bold' : ''}>{c.name}</span>
                </label>
              ))}
            </div>
            <button 
              onClick={handleAddCustomer} 
              className="text-xs text-blue-400 mt-2 hover:text-blue-300 text-left flex items-center gap-1 font-medium transition-colors"
            >
              + Přidat zákazníka
            </button>
          </div>

          <div className="w-px bg-slate-700 hidden lg:block my-2"></div>

          {/* PALETY V MENU */}
          <div className="flex items-center gap-4 flex-wrap">
            {templates.map(tpl => (
              <TemplateItem 
                key={tpl.id} 
                template={tpl} 
                currentColor={activeColor} 
                onDelete={tpl.id.startsWith('custom') ? handleDeleteTemplate : undefined}
              />
            ))}
          </div>

          <div className="w-px bg-slate-700 hidden lg:block my-2"></div>

          {/* VLASTNÍ PALETA - Zvětšená políčka */}
          <div className="flex flex-col items-center justify-center gap-2 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Přidat atyp (cm)</span>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={customW} 
                onChange={(e) => setCustomW(e.target.value ? Number(e.target.value) : '')} 
                placeholder="Délka" 
                className="w-24 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none text-center"
              />
              <span className="text-slate-500 text-xs font-black">×</span>
              <input 
                type="number" 
                value={customH} 
                onChange={(e) => setCustomH(e.target.value ? Number(e.target.value) : '')} 
                placeholder="Šířka" 
                className="w-24 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none text-center"
              />
              <button 
                onClick={handleAddCustomTemplate}
                disabled={!customW || !customH}
                className="bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 hover:bg-blue-500 text-white text-sm font-bold px-4 py-1.5 rounded shadow transition-colors ml-1"
              >
                + Menu
              </button>
            </div>
          </div>
        </div>

        <main className="flex-1 flex items-center justify-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-900 overflow-visible">
          
          <div ref={printAreaRef} className="bg-slate-800/80 p-10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-slate-700/50 backdrop-blur-sm flex flex-col items-center transition-all duration-300 relative">
            
            {/* HORNÍ LIŠTA NA PAPÍRU */}
            <div className="w-full flex justify-between items-end mb-16">
              
              {/* Levé menu (Nové vstupy pro Vlastní vůz a Výběr) */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-700/50 w-max" data-html2canvas-ignore="true">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mr-1">Vlastní vůz (cm):</span>
                  <input 
                    type="number" value={customTruckW} onChange={(e) => setCustomTruckW(e.target.value ? Number(e.target.value) : '')} placeholder="Délka" 
                    className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none text-center"
                  />
                  <span className="text-slate-500 text-xs font-black">×</span>
                  <input 
                    type="number" value={customTruckH} onChange={(e) => setCustomTruckH(e.target.value ? Number(e.target.value) : '')} placeholder="Šířka" 
                    className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none text-center"
                  />
                  <button 
                    onClick={handleAddCustomTruck} disabled={!customTruckW || !customTruckH}
                    className="bg-slate-700 disabled:bg-slate-800 disabled:text-slate-600 hover:bg-slate-600 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors ml-1"
                  >
                    + Přidat
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-slate-400 text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                    Typ vozu:
                  </span>
                  <select 
                    value={truck.id}
                    onChange={handleTruckChange}
                    className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none shadow-inner cursor-pointer"
                  >
                    {truckTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.width} × {t.height} cm)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pravé menu s tlačítky */}
              <div className="flex items-center gap-4">
                <label 
                  className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-medium bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition-colors"
                  data-html2canvas-ignore="true"
                >
                  <input 
                    type="checkbox" 
                    checked={enableSnap} 
                    onChange={(e) => setEnableSnap(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-500 text-blue-500 focus:ring-blue-500 bg-slate-800 cursor-pointer"
                  />
                  Magnet
                </label>

                <label 
                  className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-medium bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition-colors"
                  data-html2canvas-ignore="true"
                >
                  <input 
                    type="checkbox" 
                    checked={preventOverlap} 
                    onChange={(e) => setPreventOverlap(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-500 text-blue-500 focus:ring-blue-500 bg-slate-800 cursor-pointer"
                  />
                  Hlídat kolize
                </label>

                <button 
                  onClick={clearAllPallets}
                  title="Vymazat všechny palety z vozu"
                  data-html2canvas-ignore="true"
                  className="bg-red-600/90 hover:bg-red-500 active:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-lg shadow-red-600/30 transition-all transform active:scale-95 flex items-center justify-center border border-red-500/50 ml-1"
                >
                  🗑️
                </button>

                <button 
                  onClick={handleExportPDF}
                  data-html2canvas-ignore="true"
                  className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all transform active:scale-95 flex items-center gap-2 border border-emerald-500 ml-1"
                >
                  📄 Uložit do PDF
                </button>

                <span className="text-slate-400 text-sm font-semibold bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700/50 ml-2">
                  Naloženo: <span className="text-white font-black">{pallets.length}</span> ks
                </span>
              </div>
            </div>

            <div className="flex items-center ml-14 mt-8">
              <div className="relative mr-4 w-14 h-24 bg-red-600 rounded-l-2xl shadow-[-10px_0_20px_rgba(0,0,0,0.3)] border-y-4 border-l-4 border-red-700 flex items-center justify-center z-0 pointer-events-none">
                <span className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-black uppercase text-red-200 tracking-[0.3em]">
                  KABINA
                </span>
              </div>

              <div 
                id="truck-board"
                ref={setTruckRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setCursorPos(null)}
                className="relative bg-slate-200 shadow-inner ring-8 ring-slate-700 pointer-events-auto overflow-visible transition-all duration-500 ease-in-out cursor-crosshair"
                style={{ 
                  width: truck.width * SCALE, 
                  height: truck.height * SCALE,
                  backgroundImage: `
                    linear-gradient(to right, #cbd5e1 1px, transparent 1px),
                    linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)
                  `,
                  backgroundSize: `${20 * SCALE}px ${20 * SCALE}px`,
                }}
              >
                {/* DĚLÍCÍ ČÁRA PRO SOUPRAVY */}
                {truck.splitAt && (
                  <div 
                    className="absolute top-0 bottom-0 z-0 pointer-events-none flex items-center justify-center"
                    style={{ 
                      left: truck.splitAt * SCALE,
                      width: '6px',
                      transform: 'translateX(-50%)',
                      backgroundColor: 'rgba(15, 23, 42, 0.2)',
                      borderLeft: '3px dashed #f1c40f', // Výrazné žluté šrafování
                      borderRight: '3px dashed #f1c40f',
                    }}
                  >
                    <span className="text-[9px] text-[#f1c40f] font-black uppercase tracking-widest rotate-90 whitespace-nowrap bg-slate-900/80 px-2 py-1 rounded">Spoj</span>
                  </div>
                )}

                {/* DYNAMICKÉ PRAVÍTKO S PŘICHYTÁVÁNÍM */}
                {cursorPos && (
                  <div 
                    className="absolute top-0 bottom-0 w-px bg-blue-500/50 border-l-2 border-dashed border-blue-500/80 z-50 pointer-events-none transition-all duration-75"
                    style={{ left: cursorPos.x * SCALE }}
                    data-html2canvas-ignore="true"
                  >
                    <div className="absolute -top-10 left-0 -translate-x-1/2 flex items-center bg-slate-900 border border-slate-600 rounded-md shadow-xl whitespace-nowrap overflow-hidden">
                      <div className="px-3 py-1 bg-slate-800 text-white text-xs font-bold border-r border-slate-700 flex items-center gap-1">
                        {cursorPos.x} <span className="text-[10px] text-slate-400 font-normal">cm</span>
                      </div>
                      <div className="px-3 py-1 bg-emerald-900/90 text-emerald-400 text-xs font-black flex items-center gap-1">
                        {cursorPos.remX} <span className="text-[10px] text-emerald-600 font-normal">cm zbývá</span>
                      </div>
                    </div>
                    <div className="absolute -top-2 left-0 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-blue-500"></div>
                  </div>
                )}

                <div className="absolute inset-0 overflow-visible pointer-events-none">
                  {pallets.map((p) => (
                    <div key={p.id} className="pointer-events-auto inline-block transition-all duration-300">
                      <DraggablePallet 
                        pallet={p} 
                        truck={truck} 
                        onRemove={removePallet}
                        onContextMenu={handleContextMenu}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* LEGENDA ZÁKAZNÍKŮ PRO PDF EXPORT */}
            <div className="w-full mt-10 pt-6 border-t border-slate-700/50 flex items-start gap-4 flex-wrap">
              <span className="text-slate-400 text-sm font-bold uppercase tracking-widest mr-2">Legenda:</span>
              {customers.map(c => (
                <div key={`legend-${c.id}`} className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded border border-slate-700/50">
                  <div className="w-4 h-4 rounded-sm shadow-sm" style={{ backgroundColor: c.color }}></div>
                  <span className="text-slate-300 text-sm font-medium">{c.name}</span>
                </div>
              ))}
            </div>

            {/* CHYTRÝ ODHAD (SPODNÍ PANEL) */}
            <div 
              className="w-full mt-6 bg-[#0f172a] border border-slate-700 rounded-lg p-3 flex justify-center items-center shadow-inner"
              data-html2canvas-ignore="true" 
            >
              <div className="flex items-center gap-6">
                <span className="text-slate-400 text-sm font-medium">
                  {cursorPos ? "Od pravítka do konce vozu se vejde:" : "Do prázdného vozu na délku se vejde:"}
                </span>
                
                <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-md border border-slate-700">
                  <div className="w-5 h-3.5 bg-teal-600 border border-teal-400 rounded-sm shadow-sm" title="Naležato (120 cm v ose X)"></div>
                  <span className="text-slate-300 text-xs">EURO naležato:</span>
                  <span className="text-white font-bold text-sm">{euroHorizontalCount} ks</span>
                </div>

                <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-md border border-slate-700">
                  <div className="w-3.5 h-5 bg-teal-600 border border-teal-400 rounded-sm shadow-sm" title="Nastojato (80 cm v ose X)"></div>
                  <span className="text-slate-300 text-xs">EURO nastojato:</span>
                  <span className="text-white font-bold text-sm">{euroVerticalCount} ks</span>
                </div>
              </div>
            </div>

          </div>
        </main>

        <DragOverlay dropAnimation={null}>
          {activeTemplate ? (
            <div
              className="border-2 border-white/50 shadow-2xl flex items-center justify-center cursor-grabbing opacity-90 pointer-events-none transition-colors duration-300"
              style={{
                backgroundColor: activeTemplate.color,
                width: activeTemplate.width * SCALE,
                height: activeTemplate.height * SCALE,
              }}
            >
              <span className="text-[10px] font-black text-white uppercase drop-shadow-md text-center leading-tight">
                {activeTemplate.name}
              </span>
            </div>
          ) : null}
        </DragOverlay>

      </DndContext>

      {contextMenu && (
        <div 
          className="fixed z-[100] bg-slate-800 border border-slate-600 shadow-2xl rounded-md py-1 min-w-[160px] overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          data-html2canvas-ignore="true"
        >
          <button
            className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2"
            onClick={() => {
              handleRotate(contextMenu.palletId);
              setContextMenu(null);
            }}
          >
            🔄 Otočit paletu
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2"
            onClick={() => {
              handleRename(contextMenu.palletId);
              setContextMenu(null);
            }}
          >
            ✏️ Přejmenovat paletu
          </button>
        </div>
      )}

      {customerMenu && (
        <div 
          className="fixed z-[100] bg-slate-800 border border-slate-600 shadow-2xl rounded-md py-1 min-w-[160px] overflow-hidden"
          style={{ left: customerMenu.x, top: customerMenu.y }}
          data-html2canvas-ignore="true"
        >
          <button 
            className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2"
            onClick={() => {
              handleRenameCustomer(customerMenu.customerId);
              setCustomerMenu(null);
            }}
          >
            ✏️ Přejmenovat zákazníka
          </button>
        </div>
      )}

    </div>
  );
}

export default App;