import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Users, Wrench, Plus, Search,
  Trash2, DollarSign, Loader2, BarChart3,
  UserCircle, Briefcase, Menu, X,
  CheckCircle, Clock, FileText, PlusCircle, MinusCircle, Printer,
  ThumbsUp, ThumbsDown, Pencil
} from 'lucide-react';

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
const genId = () =>
  Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

function getCol<T>(name: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(`autopro_${name}`) ?? '[]') as T[];
  } catch { return []; }
}
function saveCol<T>(name: string, data: T[]) {
  localStorage.setItem(`autopro_${name}`, JSON.stringify(data));
}
function addItem<T extends object>(name: string, item: T): T & { id: string } {
  const col = getCol<T & { id: string }>(name);
  const newItem = { ...item, id: genId() };
  col.push(newItem);
  saveCol(name, col);
  return newItem;
}
function deleteItem(name: string, id: string) {
  const col = getCol<{ id: string }>(name).filter(i => i.id !== id);
  saveCol(name, col);
}


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BaseItem { id: string; createdAt: string; }
interface Customer extends BaseItem { name: string; phone?: string; }
interface Vehicle  extends BaseItem { model: string; plate?: string; }
interface Staff    extends BaseItem { name: string; specialty?: string; }
interface Service  extends BaseItem {
  description: string; value: number; paymentMethod: string;
  staffName: string; status: string; date: string;
  clientName: string; plate: string;
}
interface QuoteItem { description: string; qty: number; unitValue: number; }
interface Quote extends BaseItem {
  clientName: string; vehicleModel: string; vehiclePlate: string;
  items: QuoteItem[]; total: number;
  status: 'Pendente' | 'Aprovado' | 'Recusado';
  address?: string; phone?: string; email?: string;
  km?: string; yearModel?: string; discount?: number;
  observations?: string; paymentConditions?: string; validDays?: string;
}
interface ClientRecord extends BaseItem {
  name: string; phone?: string;
  vehicleModel?: string; vehiclePlate?: string;
  arrivedAt?: string;
}

type TabName   = 'dashboard' | 'services' | 'clients' | 'vehicles' | 'customers' | 'staff' | 'reports' | 'quotes';
type ModalType = 'service' | 'vehicle' | 'customer' | 'staff' | 'quote' | 'client';

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
const getModalType = (tab: TabName): ModalType => {
  const map: Partial<Record<TabName, ModalType>> = {
    staff: 'staff', vehicles: 'vehicle', customers: 'customer', quotes: 'quote', clients: 'client',
  };
  return map[tab] ?? 'service';
};
const getAddLabel = (tab: TabName) => {
  const map: Partial<Record<TabName, string>> = {
    staff: 'Novo MecÃ¢nico', vehicles: 'Novo VeÃ­culo', customers: 'Novo Cliente', quotes: 'Novo OrÃ§amento', clients: 'Novo Cadastro',
  };
  return map[tab] ?? 'Nova OS';
};
const getTabLabel = (tab: TabName) => {
  const map: Record<TabName, string> = {
    dashboard: 'Dashboard', services: 'ServiÃ§os', quotes: 'OrÃ§amentos',
    clients: 'Clientes & Carros', staff: 'Equipa', reports: 'RelatÃ³rios',
    vehicles: 'VeÃ­culos', customers: 'Clientes',
  };
  return map[tab] ?? tab;
};
const formatBRL = (val?: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val ?? 0);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const App: React.FC = () => {
  // App state
  const [activeTab, setActiveTab] = useState<TabName>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading]     = useState(true);

  const [customers,      setCustomers]      = useState<Customer[]>([]);
  const [vehicles,       setVehicles]       = useState<Vehicle[]>([]);
  const [services,       setServices]       = useState<Service[]>([]);
  const [staff,          setStaff]          = useState<Staff[]>([]);
  const [clientRecords,  setClientRecords]  = useState<ClientRecord[]>([]);

  const [searchTerm,      setSearchTerm]      = useState('');
  const [serviceFilter,   setServiceFilter]   = useState<'Todos' | 'Pendente' | 'Entregue'>('Todos');
  const [reportPeriod,    setReportPeriod]    = useState<'mes' | 'tudo'>('mes');
  const [expandedStaff,   setExpandedStaff]   = useState<string | null>(null);
  const [reportDateFrom,  setReportDateFrom]  = useState('');
  const [reportDateTo,    setReportDateTo]    = useState('');
  const [selectedStaffName, setSelectedStaffName] = useState<string | null>(null);
  const [showModal,       setShowModal]        = useState(false);
  const [modalType,  setModalType]  = useState<ModalType>('service');
  const [formData,   setFormData]   = useState<Record<string, string>>({
    paymentMethod: 'Dinheiro', staffName: '',
  });

  // â"€â"€ Entrega de serviÃ§o â"€â"€
  const [showDeliveryModal,   setShowDeliveryModal]   = useState(false);
  const [deliveryServiceId,   setDeliveryServiceId]   = useState<string | null>(null);
  const [deliveryPayment,     setDeliveryPayment]     = useState('Dinheiro');

  // â"€â"€ OrÃ§amentos â"€â"€
  const [quotes,          setQuotes]          = useState<Quote[]>([]);
  const [quoteClient,     setQuoteClient]     = useState('');
  const [quoteVehicle,    setQuoteVehicle]    = useState('');
  const [quotePlate,      setQuotePlate]      = useState('');
  const [quoteItems,      setQuoteItems]      = useState<QuoteItem[]>([{ description: '', qty: 1, unitValue: 0 }]);
  const [quoteAddress,       setQuoteAddress]       = useState('');
  const [quotePhone,         setQuotePhone]         = useState('');
  const [quoteEmail,         setQuoteEmail]         = useState('');
  const [quoteKm,            setQuoteKm]            = useState('');
  const [quoteYearModel,     setQuoteYearModel]     = useState('');
  const [quoteDiscount,      setQuoteDiscount]      = useState('');
  const [quoteObservations,  setQuoteObservations]  = useState('');
  const [quotePayment,       setQuotePayment]       = useState('');
  const [quoteValidDays,     setQuoteValidDays]     = useState('');
  const [editingQuoteId,  setEditingQuoteId]  = useState<string | null>(null);

  useEffect(() => {
    const SEED_KEY = 'autopro_demo_seeded_v1';
    if (!localStorage.getItem(SEED_KEY)) {
      const today = new Date();
      const d = (offset: number) => { const dt = new Date(today); dt.setDate(dt.getDate() - offset); return dt.toISOString().split('T')[0]; };
      const ts = (offset: number) => { const dt = new Date(today); dt.setDate(dt.getDate() - offset); return dt.toISOString(); };

      const demoStaff: Staff[] = [
        { id: 's1', name: 'Carlos Augusto',   specialty: 'Motor e InjeÃ§Ã£o',     createdAt: ts(90) },
        { id: 's2', name: 'Rodrigo Ferreira', specialty: 'Freios e SuspensÃ£o',  createdAt: ts(85) },
        { id: 's3', name: 'Leandro Souza',    specialty: 'ElÃ©trica Automotiva', createdAt: ts(70) },
        { id: 's4', name: 'FÃ¡bio Mendes',     specialty: 'Funilaria e Pintura', createdAt: ts(60) },
      ];
      const demoClients: ClientRecord[] = [
        { id: 'c1', name: 'Marcos Oliveira',    phone: '(21) 99812-3344', vehicleModel: 'Chevrolet Onix 2021',  vehiclePlate: 'RJA-2E34', arrivedAt: d(1),  createdAt: ts(1)  },
        { id: 'c2', name: 'PatrÃ­cia MendonÃ§a',  phone: '(21) 97654-8821', vehicleModel: 'Volkswagen Polo 2022', vehiclePlate: 'RJB-4F12', arrivedAt: d(3),  createdAt: ts(3)  },
        { id: 'c3', name: 'AndrÃ© Lima',         phone: '(21) 98345-1177', vehicleModel: 'Fiat Strada 2020',     vehiclePlate: 'RJC-7H90', arrivedAt: d(5),  createdAt: ts(5)  },
        { id: 'c4', name: 'Fernanda Costa',     phone: '(21) 96781-5502', vehicleModel: 'Toyota Corolla 2023',  vehiclePlate: 'RJD-9K55', arrivedAt: d(8),  createdAt: ts(8)  },
        { id: 'c5', name: 'Roberto Nascimento', phone: '(21) 99234-6610', vehicleModel: 'Hyundai HB20 2021',    vehiclePlate: 'RJE-1M78', arrivedAt: d(12), createdAt: ts(12) },
        { id: 'c6', name: 'Juliana Ramos',      phone: '(21) 98876-3345', vehicleModel: 'Chevrolet Cruze 2019', vehiclePlate: 'RJF-3N21', arrivedAt: d(18), createdAt: ts(18) },
        { id: 'c7', name: 'Diego Cardoso',      phone: '(21) 97112-8890', vehicleModel: 'Ford Ka 2020',         vehiclePlate: 'RJG-5P44', arrivedAt: d(25), createdAt: ts(25) },
      ];
      const demoServices: Service[] = [
        { id: 'sv1',  description: 'RevisÃ£o completa 30.000 km',        clientName: 'Marcos Oliveira',    plate: 'RJA-2E34', staffName: 'Carlos Augusto',   paymentMethod: 'Pix',      status: 'Pendente', value: 380,  date: d(0),  createdAt: ts(0)  },
        { id: 'sv2',  description: 'Troca de pastilhas de freio',        clientName: 'PatrÃ­cia MendonÃ§a',  plate: 'RJB-4F12', staffName: 'Rodrigo Ferreira', paymentMethod: 'Pix',      status: 'Pendente', value: 240,  date: d(1),  createdAt: ts(1)  },
        { id: 'sv3',  description: 'DiagnÃ³stico elÃ©trico + bateria',     clientName: 'AndrÃ© Lima',         plate: 'RJC-7H90', staffName: 'Leandro Souza',    paymentMethod: 'Dinheiro', status: 'Entregue', value: 310,  date: d(2),  createdAt: ts(2)  },
        { id: 'sv4',  description: 'Alinhamento e balanceamento',        clientName: 'Fernanda Costa',     plate: 'RJD-9K55', staffName: 'Rodrigo Ferreira', paymentMethod: 'CartÃ£o',   status: 'Entregue', value: 160,  date: d(3),  createdAt: ts(3)  },
        { id: 'sv5',  description: 'Troca de Ã³leo e filtros',            clientName: 'Roberto Nascimento', plate: 'RJE-1M78', staffName: 'Carlos Augusto',   paymentMethod: 'Dinheiro', status: 'Entregue', value: 210,  date: d(4),  createdAt: ts(4)  },
        { id: 'sv6',  description: 'Reparo sistema de injeÃ§Ã£o eletrÃ´nica', clientName: 'Juliana Ramos',   plate: 'RJF-3N21', staffName: 'Carlos Augusto',   paymentMethod: 'Pix',      status: 'Entregue', value: 490,  date: d(5),  createdAt: ts(5)  },
        { id: 'sv7',  description: 'Funilaria â€" amasso porta dianteira',  clientName: 'Diego Cardoso',     plate: 'RJG-5P44', staffName: 'FÃ¡bio Mendes',     paymentMethod: 'CartÃ£o',   status: 'Entregue', value: 850,  date: d(7),  createdAt: ts(7)  },
        { id: 'sv8',  description: 'Troca amortecedores traseiros',       clientName: 'Marcos Oliveira',   plate: 'RJA-2E34', staffName: 'Rodrigo Ferreira', paymentMethod: 'Pix',      status: 'Entregue', value: 620,  date: d(10), createdAt: ts(10) },
        { id: 'sv9',  description: 'Limpeza de bicos injetores',          clientName: 'Fernanda Costa',    plate: 'RJD-9K55', staffName: 'Carlos Augusto',   paymentMethod: 'Dinheiro', status: 'Entregue', value: 280,  date: d(12), createdAt: ts(12) },
        { id: 'sv10', description: 'InstalaÃ§Ã£o de som automotivo',        clientName: 'AndrÃ© Lima',        plate: 'RJC-7H90', staffName: 'Leandro Souza',    paymentMethod: 'CartÃ£o',   status: 'Entregue', value: 420,  date: d(15), createdAt: ts(15) },
      ];
      const demoQuotes: Quote[] = [
        { id: 'q1', clientName: 'Roberto Nascimento', vehicleModel: 'Hyundai HB20 2021', vehiclePlate: 'RJE-1M78', phone: '(21) 99234-6610', email: '', address: 'Rua das Flores, 142', km: '48.200', yearModel: '2021/2022', discount: 50, items: [{ description: 'Troca de correia dentada + tensor', qty: 1, unitValue: 380 }, { description: 'Fluido de freio DOT 4', qty: 1, unitValue: 65 }, { description: 'MÃ£o de obra', qty: 1, unitValue: 200 }], total: 595, status: 'Pendente', observations: 'Cliente relata barulho ao frear.', paymentConditions: '50% entrada + saldo na retirada', validDays: '7', createdAt: ts(1) },
        { id: 'q2', clientName: 'Juliana Ramos', vehicleModel: 'Chevrolet Cruze 2019', vehiclePlate: 'RJF-3N21', phone: '(21) 98876-3345', email: 'juliana@email.com', address: 'Av. Principal, 800', km: '72.500', yearModel: '2019/2020', discount: 0, items: [{ description: 'RevisÃ£o geral 70.000 km', qty: 1, unitValue: 420 }, { description: 'Troca de velas de igniÃ§Ã£o', qty: 4, unitValue: 45 }, { description: 'Filtro de ar', qty: 1, unitValue: 80 }], total: 680, status: 'Aprovado', observations: '', paymentConditions: 'Ã€ vista no PIX', validDays: '10', createdAt: ts(4) },
      ];

      saveCol('staff', demoStaff);
      saveCol('clientrecords', demoClients);
      saveCol('services', demoServices);
      saveCol('quotes', demoQuotes);
      localStorage.setItem(SEED_KEY, '1');

      setStaff(demoStaff);
      setClientRecords(demoClients);
      setServices(demoServices);
      setQuotes(demoQuotes);
      setLoading(false);
      return;
    }

    const oldCustomers = getCol<Customer>('customers');
    const oldVehicles  = getCol<Vehicle>('vehicles');
    setCustomers(oldCustomers);
    setVehicles(oldVehicles);
    setServices(getCol<Service>('services'));
    setStaff(getCol<Staff>('staff'));
    setQuotes(getCol<Quote>('quotes'));
    const existing = getCol<ClientRecord>('clientrecords');
    if (existing.length > 0) {
      setClientRecords(existing);
    } else {
      const migrated: ClientRecord[] = [
        ...oldCustomers.map(c => ({ id: c.id, createdAt: c.createdAt, name: c.name, phone: c.phone, vehicleModel: '', vehiclePlate: '', arrivedAt: c.createdAt?.substring(0, 10) || '' })),
        ...oldVehicles.map(v => ({ id: v.id, createdAt: v.createdAt, name: v.model || 'VeÃ­culo', vehicleModel: v.model, vehiclePlate: v.plate || '', arrivedAt: v.createdAt?.substring(0, 10) || '' })),
      ];
      if (migrated.length > 0) { saveCol('clientrecords', migrated); setClientRecords(migrated); }
    }
    setLoading(false);
  }, []);

  const handleTabChange = (tab: TabName) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    setSearchTerm('');
  };

  // â"€â"€ Reports â"€â"€
  const reportData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const calcStats = (list: Service[]) => {
      const total = list.reduce((acc, curr) => acc + (curr.value ?? 0), 0);
      const staffPerf = list.reduce<Record<string, { count: number; total: number }>>(
        (acc, curr) => {
          const name = curr.staffName || 'NÃ£o AtribuÃ­do';
          if (!acc[name]) acc[name] = { count: 0, total: 0 };
          acc[name].count += 1;
          acc[name].total += (curr.value ?? 0);
          return acc;
        }, {}
      );
      return { count: list.length, total, staffPerf };
    };
    return {
      daily:   calcStats(services.filter(s => s.date === todayStr)),
      monthly: calcStats(services.filter(s => s.date?.substring(0, 7) === todayStr.substring(0, 7))),
    };
  }, [services]);

  // â"€â"€ CRUD â"€â"€
  const handleSave = () => {
    // ValidaÃ§Ã£o bÃ¡sica
    if (modalType === 'service' && !formData.description?.trim()) return;
    if (modalType === 'staff' && !formData.name?.trim()) return;
    if (modalType === 'vehicle' && !formData.model?.trim()) return;
    if (modalType === 'client' && !formData.name?.trim()) return;
    if (modalType === 'customer' && !formData.name?.trim()) return;

    const colMap: Record<ModalType, string> = {
      customer: 'customers', vehicle: 'vehicles', staff: 'staff',
      service: 'services', quote: 'quotes', client: 'clientrecords',
    };
    const colName = colMap[modalType];
    const base = { ...formData, createdAt: new Date().toISOString() };
    if (modalType === 'service') {
      const item = addItem<Omit<Service, 'id'>>(colName, {
        ...base,
        value:         parseFloat(formData.value ?? '0'),
        status:        'Pendente',
        date:          formData.date || new Date().toISOString().split('T')[0],
        description:   formData.description ?? '',
        paymentMethod: formData.paymentMethod ?? 'Dinheiro',
        staffName:     formData.staffName ?? '',
        clientName:    formData.clientName ?? '',
        plate:         formData.plate ?? '',
      } as Omit<Service, 'id'>);
      setServices(prev => [...prev, item as Service]);
    } else if (modalType === 'staff') {
      const item = addItem(colName, { name: formData.name ?? '', specialty: formData.specialty ?? '', createdAt: base.createdAt });
      setStaff(prev => [...prev, item as Staff]);
    } else if (modalType === 'vehicle') {
      const item = addItem(colName, { model: formData.model ?? '', plate: formData.plate ?? '', createdAt: base.createdAt });
      setVehicles(prev => [...prev, item as Vehicle]);
    } else if (modalType === 'client') {
      const item = addItem<Omit<ClientRecord, 'id'>>(colName, {
        name: formData.name ?? '', phone: formData.phone ?? '',
        vehicleModel: formData.vehicleModel ?? '', vehiclePlate: formData.vehiclePlate ?? '',
        arrivedAt: formData.arrivedAt || new Date().toISOString().split('T')[0],
        createdAt: base.createdAt,
      });
      setClientRecords(prev => [...prev, item as ClientRecord]);
    } else {
      const item = addItem(colName, { name: formData.name ?? '', phone: formData.phone ?? '', createdAt: base.createdAt });
      setCustomers(prev => [...prev, item as Customer]);
    }
    setShowModal(false);
    setFormData({ paymentMethod: 'Dinheiro', staffName: '' });
  };

  const handleDelete = (id: string) => {
    const colMap: Record<TabName, string> = {
      services: 'services', staff: 'staff', vehicles: 'vehicles',
      customers: 'customers', clients: 'clientrecords', dashboard: '', reports: '', quotes: '',
    };
    const col = colMap[activeTab];
    if (!col) return;
    deleteItem(col, id);
    if (activeTab === 'services')  setServices(prev => prev.filter(i => i.id !== id));
    if (activeTab === 'staff')     setStaff(prev => prev.filter(i => i.id !== id));
    if (activeTab === 'vehicles')  setVehicles(prev => prev.filter(i => i.id !== id));
    if (activeTab === 'customers') setCustomers(prev => prev.filter(i => i.id !== id));
    if (activeTab === 'clients')   setClientRecords(prev => prev.filter(i => i.id !== id));
  };

  // â"€â"€ Entregar serviÃ§o (atualiza status + pagamento) â"€â"€
  const openDelivery = (id: string) => {
    setDeliveryServiceId(id);
    setDeliveryPayment('Dinheiro');
    setShowDeliveryModal(true);
  };

  const confirmDelivery = () => {
    if (!deliveryServiceId) return;
    const updated = services.map(s =>
      s.id === deliveryServiceId
        ? { ...s, status: 'Entregue', paymentMethod: deliveryPayment }
        : s
    );
    setServices(updated);
    saveCol('services', updated);
    setShowDeliveryModal(false);
    setDeliveryServiceId(null);
  };

  // â"€â"€ OrÃ§amento: abrir ediÃ§Ã£o â"€â"€
  const openEditQuote = (q: Quote) => {
    setEditingQuoteId(q.id);
    setQuoteClient(q.clientName);
    setQuoteVehicle(q.vehicleModel);
    setQuotePlate(q.vehiclePlate);
    setQuoteItems(q.items.length > 0 ? q.items : [{ description: '', qty: 1, unitValue: 0 }]);
    setQuoteAddress(q.address ?? '');
    setQuotePhone(q.phone ?? '');
    setQuoteEmail(q.email ?? '');
    setQuoteKm(q.km ?? '');
    setQuoteYearModel(q.yearModel ?? '');
    setQuoteDiscount(q.discount !== undefined ? String(q.discount) : '');
    setQuoteObservations(q.observations ?? '');
    setQuotePayment(q.paymentConditions ?? '');
    setQuoteValidDays(q.validDays ?? '');
    setModalType('quote');
    setShowModal(true);
  };

  // â"€â"€ OrÃ§amento: salvar (criar ou editar) â"€â"€
  const handleSaveQuote = () => {
    const validItems = quoteItems.filter(i => i.description.trim() !== '');
    if (!quoteClient.trim() || validItems.length === 0) return;
    const subtotal = validItems.reduce((acc, i) => acc + i.qty * i.unitValue, 0);
    const discountVal = parseFloat(quoteDiscount) || 0;
    const total = Math.max(0, subtotal - discountVal);
    const extra = {
      address: quoteAddress, phone: quotePhone, email: quoteEmail,
      km: quoteKm, yearModel: quoteYearModel, discount: discountVal,
      observations: quoteObservations, paymentConditions: quotePayment, validDays: quoteValidDays,
    };

    if (editingQuoteId) {
      const updated = quotes.map(q =>
        q.id === editingQuoteId
          ? { ...q, clientName: quoteClient, vehicleModel: quoteVehicle, vehiclePlate: quotePlate, items: validItems, total, ...extra }
          : q
      );
      setQuotes(updated);
      saveCol('quotes', updated);
    } else {
      const newQuote = addItem<Omit<Quote, 'id'>>('quotes', {
        clientName: quoteClient, vehicleModel: quoteVehicle, vehiclePlate: quotePlate,
        items: validItems, total, status: 'Pendente', createdAt: new Date().toISOString(), ...extra,
      });
      setQuotes(prev => [...prev, newQuote as Quote]);
    }

    setShowModal(false);
    setEditingQuoteId(null);
    setQuoteClient(''); setQuoteVehicle(''); setQuotePlate('');
    setQuoteItems([{ description: '', qty: 1, unitValue: 0 }]);
    setQuoteAddress(''); setQuotePhone(''); setQuoteEmail('');
    setQuoteKm(''); setQuoteYearModel(''); setQuoteDiscount('');
    setQuoteObservations(''); setQuotePayment(''); setQuoteValidDays('');
  };

  // â"€â"€ OrÃ§amento: mudar status â"€â"€
  const changeQuoteStatus = (id: string, status: Quote['status']) => {
    const updated = quotes.map(q => q.id === id ? { ...q, status } : q);
    setQuotes(updated);
    saveCol('quotes', updated);
  };

  // â"€â"€ OrÃ§amento: deletar â"€â"€
  const deleteQuote = (id: string) => {
    const updated = quotes.filter(q => q.id !== id);
    setQuotes(updated);
    saveCol('quotes', updated);
  };

  // â"€â"€ OrÃ§amento: gerar PDF (abre janela de impressÃ£o) â"€â"€
  const printQuote = (quote: Quote) => {
    const subtotal = quote.items.reduce((acc, i) => acc + i.qty * i.unitValue, 0);
    const discountVal = quote.discount ?? 0;
    const total = Math.max(0, subtotal - discountVal);
    const quoteNum = quote.id.slice(-6).toUpperCase();
    const dateStr = new Date(quote.createdAt).toLocaleDateString('pt-BR');

    const TOTAL_ROWS = 10;
    const dataRows = quote.items.slice(0, TOTAL_ROWS);
    const emptyCount = TOTAL_ROWS - dataRows.length;
    const itemRows = dataRows.map((i, idx) => `
      <tr>
        <td class="td-item">${idx + 1}</td>
        <td class="td-desc">${i.description}</td>
        <td class="td-num">${i.qty}</td>
        <td class="td-num">${formatBRL(i.unitValue)}</td>
        <td class="td-num">${formatBRL(i.qty * i.unitValue)}</td>
      </tr>`).join('');
    const emptyRows = Array(emptyCount).fill(`
      <tr>
        <td class="td-item">&nbsp;</td>
        <td class="td-desc"></td>
        <td class="td-num"></td>
        <td class="td-num"></td>
        <td class="td-num"></td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>Nota de OrÃ§amento â€" Gilmar Auto Center</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;color:#000;font-size:12px;padding:28px 32px;background:#fff}
        /* HEADER */
        .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #000;padding-bottom:10px;margin-bottom:12px}
        .logo-wrap{display:flex;flex-direction:column;gap:2px}
        .logo-brand{font-size:28px;font-weight:900;color:#1a1a2e;letter-spacing:1px;line-height:1}
        .logo-sub{font-size:11px;font-weight:800;letter-spacing:4px;color:#2563eb;border-top:2px solid #2563eb;border-bottom:2px solid #2563eb;padding:2px 0;margin-top:2px}
        .logo-car{font-size:9px;color:#555;margin-top:2px}
        .header-right{text-align:right}
        .nota-title{font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:1px}
        .header-fields{margin-top:8px;font-size:11px;border:1px solid #ccc}
        .header-fields tr td{padding:4px 8px;border-bottom:1px solid #ccc}
        .header-fields tr:last-child td{border-bottom:none}
        .header-fields td:first-child{font-weight:700;white-space:nowrap}
        .header-fields td:last-child{min-width:160px;border-bottom:1px solid #aaa}
        /* CLIENT SECTION */
        .client-section{border:1px solid #ccc;padding:8px 12px;margin-bottom:10px;font-size:11px}
        .client-row{display:flex;align-items:baseline;gap:4px;border-bottom:1px solid #ddd;padding:4px 0}
        .client-row:last-child{border-bottom:none}
        .client-label{font-weight:700;white-space:nowrap;min-width:75px}
        .client-value{flex:1;border-bottom:1px solid #999;min-height:16px}
        .client-half{display:flex;gap:16px;flex:1}
        .client-half .client-sub{display:flex;align-items:baseline;gap:4px;flex:1}
        .client-half .client-sub .client-label{min-width:60px}
        /* TABLE */
        .items-table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px;position:relative}
        .items-table thead tr{background:#1a1a2e;color:#fff}
        .items-table thead th{padding:7px 6px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border:1px solid #1a1a2e}
        .items-table th.th-num,.items-table td.td-num{text-align:center}
        .items-table td.td-item{text-align:center;width:40px}
        .items-table td.td-desc{width:auto}
        .items-table td{padding:7px 6px;border:1px solid #ccc;height:26px}
        .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-20deg);font-size:52px;font-weight:900;color:rgba(0,0,0,0.06);text-align:center;pointer-events:none;line-height:1.1;white-space:nowrap}
        .table-wrap{position:relative}
        /* FOOTER SECTION */
        .footer-section{display:flex;gap:10px;margin-bottom:10px}
        .footer-left{flex:1.2;border:1px solid #ccc;padding:8px 10px;font-size:11px}
        .footer-left .fl-label{font-weight:700;font-size:11px;margin-bottom:4px;display:block}
        .obs-line{border-bottom:1px solid #999;height:18px;margin-bottom:4px}
        .pagamento-line{border-bottom:1px solid #999;height:18px;margin-top:4px}
        .validade{font-size:11px;margin-top:8px}
        .footer-right{flex:.8;display:flex;flex-direction:column;gap:0}
        .totals-box{border:1px solid #ccc;font-size:11px}
        .totals-row{display:flex;border-bottom:1px solid #ccc}
        .totals-row:last-child{border-bottom:none}
        .totals-label{font-weight:700;padding:6px 10px;flex:1;background:#f0f0f0;text-transform:uppercase;font-size:11px}
        .totals-value{padding:6px 10px;min-width:110px;border-left:1px solid #ccc}
        .totals-row.total-final .totals-label,.totals-row.total-final .totals-value{background:#e8e8e8;font-weight:900}
        .signature-box{margin-top:auto;padding-top:30px;text-align:right;font-size:10px;color:#555}
        .sig-line{border-top:1px solid #000;width:100%;margin-bottom:4px}
        /* BOTTOM BAR */
        .bottom-bar{border-top:3px solid #cc0000;padding-top:8px;display:flex;justify-content:space-between;font-size:10.5px;color:#222;margin-top:4px}
        .bottom-item{display:flex;align-items:center;gap:6px}
        .bottom-item b{font-size:11px}
        .bottom-icon{font-size:14px}
        @media print{body{padding:10px 14px}@page{margin:8mm}}
      </style></head><body>

      <!-- HEADER -->
      <div class="header">
        <div class="logo-wrap">
          <div class="logo-brand">AutoCenter Pro</div>
          <div class="logo-sub">â€" SISTEMA DE GESTÃƒO â€"</div>
        </div>
        <div class="header-right">
          <div class="nota-title">Nota de OrÃ§amento</div>
          <table class="header-fields">
            <tr><td>NÂº do OrÃ§amento:</td><td>${quoteNum}</td></tr>
            <tr><td>Data:</td><td>${dateStr}</td></tr>
          </table>
        </div>
      </div>

      <!-- DADOS DO CLIENTE -->
      <div class="client-section">
        <div class="client-row">
          <span class="client-label">Cliente:</span>
          <span class="client-value">${quote.clientName}</span>
        </div>
        <div class="client-row">
          <span class="client-label">EndereÃ§o:</span>
          <span class="client-value">${quote.address ?? ''}</span>
        </div>
        <div class="client-row">
          <div class="client-half">
            <div class="client-sub"><span class="client-label">Telefone:</span><span class="client-value">${quote.phone ?? ''}</span></div>
            <div class="client-sub"><span class="client-label">E-mail:</span><span class="client-value">${quote.email ?? ''}</span></div>
          </div>
        </div>
        <div class="client-row">
          <div class="client-half">
            <div class="client-sub"><span class="client-label">VeÃ­culo:</span><span class="client-value">${quote.vehicleModel ?? ''}</span></div>
            <div class="client-sub"><span class="client-label">Placa:</span><span class="client-value">${quote.vehiclePlate ?? ''}</span></div>
          </div>
        </div>
        <div class="client-row">
          <div class="client-half">
            <div class="client-sub"><span class="client-label">Km:</span><span class="client-value">${quote.km ?? ''}</span></div>
            <div class="client-sub"><span class="client-label">Ano/Modelo:</span><span class="client-value">${quote.yearModel ?? ''}</span></div>
          </div>
        </div>
      </div>

      <!-- TABELA DE ITENS -->
      <div class="table-wrap">
        <div class="watermark">AUTO<br>CENTER<br>PRO</div>
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:40px;text-align:center">Item</th>
              <th>DescriÃ§Ã£o dos ServiÃ§os / PeÃ§as</th>
              <th style="width:60px;text-align:center">Qtd.</th>
              <th style="width:100px;text-align:center">Valor Unit.</th>
              <th style="width:100px;text-align:center">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
            ${emptyRows}
          </tbody>
        </table>
      </div>

      <!-- RODAPÃ‰: observaÃ§Ãµes + totais -->
      <div class="footer-section">
        <div class="footer-left">
          <span class="fl-label">ObservaÃ§Ãµes:</span>
          <div class="obs-line">${quote.observations ?? ''}</div>
          <div class="obs-line"></div>
          <div class="obs-line"></div>
          <br>
          <span class="fl-label">CondiÃ§Ãµes de Pagamento:</span>
          <div class="pagamento-line">${quote.paymentConditions ?? ''}</div>
          <div class="validade">OrÃ§amento vÃ¡lido por <u>&nbsp;&nbsp;${quote.validDays ?? '___'}&nbsp;&nbsp;</u> dias.</div>
        </div>
        <div class="footer-right">
          <div class="totals-box">
            <div class="totals-row">
              <span class="totals-label">Subtotal</span>
              <span class="totals-value">R$ ${subtotal.toFixed(2).replace('.',',')}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label">Desconto</span>
              <span class="totals-value">R$ ${discountVal.toFixed(2).replace('.',',')}</span>
            </div>
            <div class="totals-row total-final">
              <span class="totals-label">Total</span>
              <span class="totals-value">R$ ${total.toFixed(2).replace('.',',')}</span>
            </div>
          </div>
          <div class="signature-box">
            <div class="sig-line"></div>
            Assinatura / Carimbo
          </div>
        </div>
      </div>

      <!-- BARRA INFERIOR -->
      <div class="bottom-bar">
        <div style="display:flex;gap:28px">
          <div class="bottom-item"><span class="bottom-icon">ðŸ"§</span><span><b>AutoCenter Pro</b> â€" Sistema de GestÃ£o</span></div>
        </div>
        <div class="bottom-item"><span class="bottom-icon">ðŸ"‹</span><div>Documento gerado automaticamente pelo sistema</div></div>
      </div>

      <script>window.onload=()=>{window.print()}<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  // â"€â"€ OrÃ§amento: enviar via WhatsApp â"€â"€
  const shareWhatsApp = (quote: Quote) => {
    const num = `#${quote.id.slice(-6).toUpperCase()}`;
    const data = new Date(quote.createdAt).toLocaleDateString('pt-BR');
    const itens = quote.items
      .map(i => `  â€¢ ${i.description} (${i.qty}x) â€" ${formatBRL(i.qty * i.unitValue)}`)
      .join('\n');
    const veiculo = [quote.vehicleModel, quote.vehiclePlate].filter(Boolean).join(' Â· ');
    const msg = [
      `ðŸ"§ *OrÃ§amento AutoCenter Pro* ${num}`,
      `ðŸ"… Data: ${data}`,
      ``,
      `ðŸ'¤ Cliente: *${quote.clientName}*`,
      veiculo ? `ðŸš— VeÃ­culo: ${veiculo}` : '',
      ``,
      `ðŸ"‹ *ServiÃ§os / Itens:*`,
      itens,
      ``,
      `ðŸ'° *Total: ${formatBRL(quote.total)}*`,
      ``,
      `ðŸ"ž Entre em contato conosco para mais informaÃ§Ãµes.`,
    ].filter(l => l !== null && l !== undefined).join('\n');

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const getTableData = (): BaseItem[] => {
    if (activeTab === 'services')  return services;
    if (activeTab === 'staff')     return staff;
    if (activeTab === 'customers') return customers;
    if (activeTab === 'clients')   return clientRecords;
    return vehicles;
  };
  const getTableHeaders = () => {
    if (activeTab === 'staff')    return ['Profissional', 'Especialidade', 'Admitido em'];
    if (activeTab === 'vehicles') return ['Modelo', 'Placa', 'Cadastrado em'];
    if (activeTab === 'customers') return ['Cliente', 'Telefone', 'Cadastrado em'];
    if (activeTab === 'clients')  return ['Cliente Â· Telefone', 'VeÃ­culo Â· Placa', 'Chegada'];
    return ['ServiÃ§o / Cliente', 'Placa Â· MecÃ¢nico', 'Status'];
  };
  const getTableCells = (item: BaseItem) => {
    if (activeTab === 'staff')     { const s = item as Staff;     return [s.name, s.specialty || '-', s.createdAt?.substring(0,10) || '-']; }
    if (activeTab === 'vehicles')  { const v = item as Vehicle;   return [v.model, v.plate || '-', v.createdAt?.substring(0,10) || '-']; }
    if (activeTab === 'customers') { const c = item as Customer;  return [c.name, c.phone || '-', c.createdAt?.substring(0,10) || '-']; }
    if (activeTab === 'clients') {
      const cr = item as ClientRecord;
      const namePhone = cr.phone ? `${cr.name}  Â·  ${cr.phone}` : cr.name;
      const vehicleInfo = [cr.vehicleModel, cr.vehiclePlate].filter(Boolean).join('  Â·  ') || 'â€"';
      return [namePhone, vehicleInfo, cr.arrivedAt || 'â€"'];
    }
    const sv = item as Service;
    const svcTitle = sv.clientName ? `${sv.description} Â· ${sv.clientName}` : sv.description;
    const svcSub   = [sv.plate, sv.staffName || 'Sem mecÃ¢nico'].filter(Boolean).join(' Â· ');
    return [svcTitle, svcSub, sv.status || 'Pendente'];
  };

  const tableData = getTableData().filter(i => {
    const matchSearch = JSON.stringify(i).toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab !== 'services') return matchSearch;
    const svc = i as Service;
    const matchFilter = serviceFilter === 'Todos' || svc.status === serviceFilter;
    return matchSearch && matchFilter;
  });
  const tableHeaders = getTableHeaders();

  return (
    <div className="flex h-screen bg-[#FFF7ED] text-slate-900 overflow-hidden font-sans">

      {/* Modal de registo (OS / Veículo / etc) */}
      {showModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-50"
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditingQuoteId(null); } }}
        >
          <div className="bg-white rounded-t-3xl md:rounded-[32px] p-6 md:p-10 w-full md:max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6 md:hidden" />
            <h2 className="text-xl md:text-2xl font-black mb-6">
              {modalType === 'staff' ? 'Novo Profissional' : modalType === 'vehicle' ? 'Novo VeÃ­culo' : modalType === 'customer' ? 'Novo Cliente' : modalType === 'client' ? 'Novo Cadastro' : modalType === 'quote' ? (editingQuoteId ? 'Editar OrÃ§amento' : 'Novo OrÃ§amento') : 'Novo ServiÃ§o'}
            </h2>
            <div className="space-y-4">
              {modalType === 'staff' && (
                <>
                  <input placeholder="Nome do MecÃ¢nico" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, name: e.target.value}))} />
                  <input placeholder="Especialidade (Ex: SuspensÃ£o, Motor)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, specialty: e.target.value}))} />
                </>
              )}
              {modalType === 'vehicle' && (
                <>
                  <input placeholder="Modelo do VeÃ­culo (Ex: Civic 2022)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, model: e.target.value}))} />
                  <input placeholder="Placa (Ex: ABC-1234)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, plate: e.target.value}))} />
                </>
              )}
              {modalType === 'customer' && (
                <>
                  <input placeholder="Nome do Cliente" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, name: e.target.value}))} />
                  <input placeholder="Telefone (Ex: 11 99999-9999)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, phone: e.target.value}))} />
                </>
              )}
              {modalType === 'client' && (
                <>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Dados do Cliente</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="Nome do Cliente *"
                      className="p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm"
                      onChange={e => setFormData(f => ({...f, name: e.target.value}))}
                    />
                    <input
                      placeholder="Telefone"
                      className="p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm"
                      onChange={e => setFormData(f => ({...f, phone: e.target.value}))}
                    />
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 pt-1">Dados do VeÃ­culo</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="Modelo (Ex: Civic 2022)"
                      className="p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm"
                      onChange={e => setFormData(f => ({...f, vehicleModel: e.target.value}))}
                    />
                    <input
                      placeholder="Placa (Ex: ABC-1234)"
                      className="p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm uppercase"
                      onChange={e => setFormData(f => ({...f, vehiclePlate: e.target.value.toUpperCase()}))}
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Data de Chegada do Carro</p>
                    <input
                      type="date"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm text-slate-700"
                      onChange={e => setFormData(f => ({...f, arrivedAt: e.target.value}))}
                    />
                  </div>
                </>
              )}
              {modalType === 'service' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <AutocompleteInput
                      placeholder="Nome do Cliente *"
                      value={formData.clientName ?? ''}
                      onChange={val => setFormData(f => ({ ...f, clientName: val }))}
                      suggestions={clientRecords.map(cr => ({
                        display: cr.phone ? `${cr.name}  Â·  ${cr.phone}` : cr.name,
                        value: cr.name,
                      }))}
                    />
                    <AutocompleteInput
                      placeholder="Placa *"
                      value={formData.plate ?? ''}
                      onChange={val => setFormData(f => ({ ...f, plate: val }))}
                      uppercase
                      suggestions={clientRecords
                        .filter(cr => cr.vehiclePlate)
                        .map(cr => ({
                          display: cr.vehicleModel ? `${cr.vehiclePlate}  Â·  ${cr.vehicleModel}` : cr.vehiclePlate!,
                          value: cr.vehiclePlate!,
                        }))}
                    />
                  </div>
                  <input placeholder="DescriÃ§Ã£o do ServiÃ§o" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, description: e.target.value}))} />
                  <input type="number" placeholder="Valor estimado (BRL)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, value: e.target.value}))} />
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Profissional ResponsÃ¡vel</p>
                    <select className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 text-sm" onChange={e => setFormData(f => ({...f, staffName: e.target.value}))}>
                      <option value="">Selecione o mecÃ¢nico...</option>
                      {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  {/* Info: pagamento Ã© definido na entrega */}
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl p-3">
                    <Clock size={14} className="text-amber-500 flex-shrink-0" />
                    <p className="text-[11px] text-amber-700 font-bold">A forma de pagamento serÃ¡ definida na entrega do serviÃ§o.</p>
                  </div>
                </>
              )}
              {modalType === 'quote' && (
                <>
                  {/* Cliente + VeÃ­culo */}
                  <AutocompleteInput
                    placeholder="Nome do Cliente *"
                    value={quoteClient}
                    onChange={setQuoteClient}
                    suggestions={clientRecords.map(cr => ({
                      display: cr.phone ? `${cr.name}  Â·  ${cr.phone}` : cr.name,
                      value: cr.name,
                    }))}
                  />
                  <input placeholder="EndereÃ§o" value={quoteAddress} onChange={e => setQuoteAddress(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Telefone" value={quotePhone} onChange={e => setQuotePhone(e.target.value)} className="p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                    <input placeholder="E-mail" value={quoteEmail} onChange={e => setQuoteEmail(e.target.value)} className="p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <AutocompleteInput
                      placeholder="Modelo do VeÃ­culo"
                      value={quoteVehicle}
                      onChange={val => {
                        setQuoteVehicle(val);
                        const found = clientRecords.find(cr => cr.vehicleModel === val);
                        if (found?.vehiclePlate) setQuotePlate(found.vehiclePlate);
                      }}
                      suggestions={clientRecords.filter(cr => cr.vehicleModel).map(cr => ({
                        display: cr.vehiclePlate ? `${cr.vehicleModel}  Â·  ${cr.vehiclePlate}` : cr.vehicleModel!,
                        value: cr.vehicleModel!,
                      }))}
                    />
                    <AutocompleteInput
                      placeholder="Placa"
                      value={quotePlate}
                      onChange={val => {
                        setQuotePlate(val);
                        const found = clientRecords.find(cr => cr.vehiclePlate === val);
                        if (found?.vehicleModel) setQuoteVehicle(found.vehicleModel);
                      }}
                      uppercase
                      suggestions={clientRecords
                        .filter(cr => cr.vehiclePlate)
                        .map(cr => ({
                          display: cr.vehicleModel ? `${cr.vehiclePlate}  Â·  ${cr.vehicleModel}` : cr.vehiclePlate!,
                          value: cr.vehiclePlate!,
                        }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Km" value={quoteKm} onChange={e => setQuoteKm(e.target.value)} className="p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                    <input placeholder="Ano/Modelo" value={quoteYearModel} onChange={e => setQuoteYearModel(e.target.value)} className="p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                  </div>

                  {/* Itens do orÃ§amento */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">ServiÃ§os / Itens *</p>
                      <button
                        onClick={() => setQuoteItems(prev => [...prev, { description: '', qty: 1, unitValue: 0 }])}
                        className="flex items-center gap-1 text-orange-600 text-xs font-bold hover:text-orange-700"
                      >
                        <PlusCircle size={14} /> Adicionar item
                      </button>
                    </div>
                    <div className="space-y-2">
                      {quoteItems.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            placeholder="DescriÃ§Ã£o do serviÃ§o"
                            value={item.description}
                            onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, description: e.target.value } : it))}
                            className="flex-1 p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm min-w-0"
                          />
                          <input
                            type="number"
                            placeholder="Qtd"
                            value={item.qty}
                            min={1}
                            onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: parseInt(e.target.value) || 1 } : it))}
                            className="w-14 p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm text-center"
                          />
                          <input
                            type="number"
                            placeholder="R$"
                            value={item.unitValue || ''}
                            min={0}
                            onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, unitValue: parseFloat(e.target.value) || 0 } : it))}
                            className="w-24 p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm"
                          />
                          {quoteItems.length > 1 && (
                            <button onClick={() => setQuoteItems(prev => prev.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                              <MinusCircle size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Desconto */}
                  <input
                    type="number"
                    placeholder="Desconto (R$)"
                    value={quoteDiscount}
                    min={0}
                    onChange={e => setQuoteDiscount(e.target.value)}
                    className="w-full p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm"
                  />

                  {/* Total */}
                  <div className="flex justify-between items-center bg-orange-50 rounded-2xl p-4 border border-orange-100">
                    <span className="text-sm font-black text-slate-600">Total do OrÃ§amento</span>
                    <span className="text-lg font-black text-orange-600">
                      {formatBRL(Math.max(0, quoteItems.reduce((acc, i) => acc + i.qty * i.unitValue, 0) - (parseFloat(quoteDiscount) || 0)))}
                    </span>
                  </div>

                  {/* ObservaÃ§Ãµes */}
                  <textarea
                    placeholder="ObservaÃ§Ãµes"
                    value={quoteObservations}
                    onChange={e => setQuoteObservations(e.target.value)}
                    rows={2}
                    className="w-full p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm resize-none"
                  />

                  {/* CondiÃ§Ãµes de pagamento + validade */}
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="CondiÃ§Ãµes de Pagamento" value={quotePayment} onChange={e => setQuotePayment(e.target.value)} className="p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                    <input placeholder="VÃ¡lido por (dias)" value={quoteValidDays} onChange={e => setQuoteValidDays(e.target.value)} className="p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                  </div>
                </>
              )}
              <div className="flex gap-3 pt-4 border-t">
                <button onClick={() => { setShowModal(false); setEditingQuoteId(null); }} className="flex-1 p-4 font-bold text-slate-400 hover:text-slate-600 transition-colors text-sm">Cancelar</button>
                <button
                  onClick={modalType === 'quote' ? handleSaveQuote : handleSave}
                  className="flex-1 p-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-700 transition-all text-sm"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          MODAL HISTÃ"RICO DO MECÃ‚NICO
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {selectedStaffName && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-[60]"
          onClick={e => { if (e.target === e.currentTarget) setSelectedStaffName(null); }}
        >
          <div className="bg-white rounded-t-3xl md:rounded-[32px] p-6 md:p-8 w-full md:max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5 md:hidden" />

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 text-orange-600 p-2.5 rounded-xl">
                  <UserCircle size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">{selectedStaffName}</h2>
                  <p className="text-xs text-slate-400 font-bold">HistÃ³rico de ServiÃ§os</p>
                </div>
              </div>
              <button onClick={() => setSelectedStaffName(null)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            {(() => {
              const staffSvcs = services
                .filter(s => s.staffName === selectedStaffName)
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
              const totalVal = staffSvcs.reduce((acc, s) => acc + (s.value ?? 0), 0);
              return (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-orange-50 rounded-2xl p-4 text-center">
                      <p className="text-2xl font-black text-orange-600">{staffSvcs.length}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">ServiÃ§os</p>
                    </div>
                    <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                      <p className="text-lg font-black text-emerald-600">{formatBRL(totalVal)}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Faturado</p>
                    </div>
                  </div>
                  {staffSvcs.length === 0 ? (
                    <p className="text-center text-slate-400 py-8 text-sm">Nenhum serviÃ§o registrado para este mecÃ¢nico.</p>
                  ) : (
                    <div className="space-y-2">
                      {staffSvcs.map(s => (
                        <div key={s.id} className="bg-slate-50 rounded-2xl p-4 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 text-sm truncate">{s.description}</p>
                            {s.clientName && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">ðŸ'¤ {s.clientName}{s.plate ? ` Â· ${s.plate}` : ''}</p>
                            )}
                            <p className="text-[10px] text-slate-400 font-bold mt-1">ðŸ"… {s.date || 'â€"'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <span className="font-black text-orange-600 text-sm">{formatBRL(s.value)}</span>
                            <StatusBadge status={s.status} paymentMethod={s.paymentMethod} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          MODAL ENTREGA DO SERVIÃ‡O
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-[60]">
          <div className="bg-white rounded-t-3xl md:rounded-[32px] p-6 md:p-10 w-full md:max-w-sm shadow-2xl">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6 md:hidden" />

            <div className="flex flex-col items-center mb-8">
              <div className="bg-emerald-500 p-4 rounded-2xl mb-4 shadow-lg shadow-emerald-200">
                <CheckCircle size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-slate-800">Entregar ServiÃ§o</h2>
              <p className="text-sm text-slate-400 mt-1 text-center">Selecione a forma de pagamento para finalizar</p>
            </div>

            <div className="mb-6">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Forma de Pagamento</p>
              <div className="grid grid-cols-3 gap-2">
                {['Dinheiro', 'Pix', 'CartÃ£o'].map(method => (
                  <button
                    key={method}
                    onClick={() => setDeliveryPayment(method)}
                    className={`p-3 rounded-2xl font-bold text-sm border-2 transition-all ${
                      deliveryPayment === method
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowDeliveryModal(false)} className="flex-1 p-4 font-bold text-slate-400 hover:text-slate-600 transition-colors text-sm">
                Cancelar
              </button>
              <button onClick={confirmDelivery} className="flex-1 p-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all text-sm">
                Confirmar Entrega
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
interface NavItemProps {
  id: TabName; icon: React.ElementType<any>; label: string;
  active: TabName; onClick: (id: TabName) => void;
}
const NavItem: React.FC<NavItemProps> = ({ id, icon: Icon, label, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group ${
      active === id
        ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/30'
        : 'text-slate-500 hover:text-white hover:bg-white/5'
    }`}
  >
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${active === id ? 'bg-white/20' : 'bg-white/0 group-hover:bg-white/10'}`}>
      <Icon size={15} />
    </div>
    <span className="text-xs font-bold">{label}</span>
  </button>
);

const BottomNavItem: React.FC<NavItemProps> = ({ id, icon: Icon, label, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${
      active === id ? 'text-orange-400' : 'text-slate-600 hover:text-slate-400'
    }`}
  >
    <Icon size={20} />
    <span className="text-[9px] mt-1 font-bold truncate w-full text-center px-1">{label}</span>
  </button>
);

interface StatBoxProps { title: string; value: string; icon: React.ElementType<any>; gradient: string; }
const StatBox: React.FC<StatBoxProps> = ({ title, value, icon: Icon, gradient }) => (
  <div className={`rounded-2xl p-5 bg-gradient-to-br ${gradient} text-white shadow-lg relative overflow-hidden`}>
    <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/10 -translate-y-8 translate-x-8" />
    <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-black/10 translate-y-6 -translate-x-6" />
    <div className="relative z-10 flex items-start justify-between">
      <div>
        <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-2xl font-black text-white">{value}</p>
      </div>
      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
        <Icon size={20} className="text-white" />
      </div>
    </div>
  </div>
);

interface StatusBadgeProps { status: string; paymentMethod?: string; }
const StatusBadge: React.FC<StatusBadgeProps> = ({ status, paymentMethod }) => {
  if (status === 'Entregue') {
    return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full">
        <CheckCircle size={10} />
        Entregue{paymentMethod ? ` Â· ${paymentMethod}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-full">
      <Clock size={10} />
      Pendente
    </span>
  );
};

interface QuoteStatusBadgeProps { status: Quote['status']; }
const QuoteStatusBadge: React.FC<QuoteStatusBadgeProps> = ({ status }) => {
  if (status === 'Aprovado') return (
    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full">
      <ThumbsUp size={10} /> Aprovado
    </span>
  );
  if (status === 'Recusado') return (
    <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 text-[10px] font-black px-2.5 py-1 rounded-full">
      <ThumbsDown size={10} /> Recusado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-full">
      <Clock size={10} /> Pendente
    </span>
  );
};

// ---------------------------------------------------------------------------
// AutocompleteInput
// ---------------------------------------------------------------------------
interface ACSuggestion { display: string; value: string; }
interface AutocompleteInputProps {
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  suggestions: ACSuggestion[];
  className?: string;
  uppercase?: boolean;
}
const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  placeholder, value, onChange, suggestions, className = '', uppercase = false,
}) => {
  const [open, setOpen] = React.useState(false);
  const filtered = value.length === 0
    ? suggestions.slice(0, 8)
    : suggestions.filter(s => s.display.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
  return (
    <div className="relative">
      <input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-orange-300 ${className}`}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-[70] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
          {filtered.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => { onChange(s.value); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-orange-50 hover:text-orange-700 transition-colors border-b border-slate-50 last:border-0 truncate"
            >
              {s.display}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// WhatsApp SVG icon (lucide nÃ£o possui)
const WhatsAppIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);


export default App;


