import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Users, Wrench, Plus, Search,
  Trash2, DollarSign, Loader2, BarChart3,
  UserCircle, Briefcase, Menu, X, Lock, Eye, EyeOff, KeyRound, LogOut,
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
// Auth helpers
// ---------------------------------------------------------------------------
const AUTH_KEY  = 'autopro_auth';
const PWD_KEY   = 'autopro_admin_pwd';
const DEFAULT_PWD = 'admin123';

const getStoredPwd  = () => localStorage.getItem(PWD_KEY) || DEFAULT_PWD;
const isAuthValid   = () => sessionStorage.getItem(AUTH_KEY) === 'true';
const setAuthValid  = (v: boolean) =>
  v ? sessionStorage.setItem(AUTH_KEY, 'true') : sessionStorage.removeItem(AUTH_KEY);

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
  // â”€â”€ Auth state â”€â”€
  const [isAuthenticated, setIsAuthenticated] = useState(isAuthValid);
  const [showChangePwd,   setShowChangePwd]    = useState(false);
  const [pwdInput,        setPwdInput]         = useState('');
  const [pwdVisible,      setPwdVisible]       = useState(false);
  const [pwdError,        setPwdError]         = useState('');
  const [newPwd,          setNewPwd]           = useState('');
  const [confirmPwd,      setConfirmPwd]       = useState('');
  const [newPwdVisible,   setNewPwdVisible]    = useState(false);

  // â”€â”€ App state â”€â”€
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

  // â”€â”€ Entrega de serviÃ§o â”€â”€
  const [showDeliveryModal,   setShowDeliveryModal]   = useState(false);
  const [deliveryServiceId,   setDeliveryServiceId]   = useState<string | null>(null);
  const [deliveryPayment,     setDeliveryPayment]     = useState('Dinheiro');

  // â”€â”€ OrÃ§amentos â”€â”€
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
        { id: 'sv7',  description: 'Funilaria â€“ amasso porta dianteira',  clientName: 'Diego Cardoso',     plate: 'RJG-5P44', staffName: 'FÃ¡bio Mendes',     paymentMethod: 'CartÃ£o',   status: 'Entregue', value: 850,  date: d(7),  createdAt: ts(7)  },
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

  // â”€â”€ Auth actions â”€â”€
  const handleAdminLogin = () => {
    if (pwdInput === getStoredPwd()) {
      setIsAuthenticated(true);
      setAuthValid(true);
      setPwdInput('');
      setPwdError('');
      setPwdVisible(false);
    } else {
      setPwdError('Senha incorreta. Tente novamente.');
      setPwdInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthValid(false);
    setActiveTab('dashboard');
    setSidebarOpen(false);
  };

  const handleChangePassword = () => {
    if (newPwd.length < 4) {
      setPwdError('A senha deve ter pelo menos 4 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('As senhas nÃ£o coincidem.');
      return;
    }
    localStorage.setItem(PWD_KEY, newPwd);
    setNewPwd('');
    setConfirmPwd('');
    setPwdError('');
    setShowChangePwd(false);
    alert('Senha alterada com sucesso!');
  };

  const handleTabChange = (tab: TabName) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    setSearchTerm('');
  };

  // â”€â”€ Reports â”€â”€
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

  // â”€â”€ CRUD â”€â”€
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

  // â”€â”€ Entregar serviÃ§o (atualiza status + pagamento) â”€â”€
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

  // â”€â”€ OrÃ§amento: abrir ediÃ§Ã£o â”€â”€
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

  // â”€â”€ OrÃ§amento: salvar (criar ou editar) â”€â”€
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

  // â”€â”€ OrÃ§amento: mudar status â”€â”€
  const changeQuoteStatus = (id: string, status: Quote['status']) => {
    const updated = quotes.map(q => q.id === id ? { ...q, status } : q);
    setQuotes(updated);
    saveCol('quotes', updated);
  };

  // â”€â”€ OrÃ§amento: deletar â”€â”€
  const deleteQuote = (id: string) => {
    const updated = quotes.filter(q => q.id !== id);
    setQuotes(updated);
    saveCol('quotes', updated);
  };

  // â”€â”€ OrÃ§amento: gerar PDF (abre janela de impressÃ£o) â”€â”€
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
      <title>Nota de OrÃ§amento â€“ Gilmar Auto Center</title>
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
          <div class="logo-sub">â€” SISTEMA DE GESTÃƒO â€”</div>
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
          <div class="bottom-item"><span class="bottom-icon">ðŸ”§</span><span><b>AutoCenter Pro</b> â€” Sistema de GestÃ£o</span></div>
        </div>
        <div class="bottom-item"><span class="bottom-icon">ðŸ“‹</span><div>Documento gerado automaticamente pelo sistema</div></div>
      </div>

      <script>window.onload=()=>{window.print()}<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  // â”€â”€ OrÃ§amento: enviar via WhatsApp â”€â”€
  const shareWhatsApp = (quote: Quote) => {
    const num = `#${quote.id.slice(-6).toUpperCase()}`;
    const data = new Date(quote.createdAt).toLocaleDateString('pt-BR');
    const itens = quote.items
      .map(i => `  â€¢ ${i.description} (${i.qty}x) â€” ${formatBRL(i.qty * i.unitValue)}`)
      .join('\n');
    const veiculo = [quote.vehicleModel, quote.vehiclePlate].filter(Boolean).join(' Â· ');
    const msg = [
      `ðŸ”§ *OrÃ§amento AutoCenter Pro* ${num}`,
      `ðŸ“… Data: ${data}`,
      ``,
      `ðŸ‘¤ Cliente: *${quote.clientName}*`,
      veiculo ? `ðŸš— VeÃ­culo: ${veiculo}` : '',
      ``,
      `ðŸ“‹ *ServiÃ§os / Itens:*`,
      itens,
      ``,
      `ðŸ’° *Total: ${formatBRL(quote.total)}*`,
      ``,
      `ðŸ“ž Entre em contato conosco para mais informaÃ§Ãµes.`,
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
      const vehicleInfo = [cr.vehicleModel, cr.vehiclePlate].filter(Boolean).join('  Â·  ') || 'â€”';
      return [namePhone, vehicleInfo, cr.arrivedAt || 'â€”'];
    }
    const sv = item as Service;
    const svcTitle = sv.clientName ? `${sv.description} Â· ${sv.clientName}` : sv.description;
    const svcSub   = [sv.plate, sv.staffName || 'Sem mecÃ¢nico'].filter(Boolean).join(' Â· ');
    return [svcTitle, svcSub, sv.status || 'Pendente'];
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#1C1917]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-900/50">
          <Wrench size={24} className="text-white" />
        </div>
        <Loader2 className="animate-spin text-orange-400" size={24} />
      </div>
    </div>
  );

  // â”€â”€ Tela de login â”€â”€
  if (!isAuthenticated) return (
    <div className="h-screen flex overflow-hidden bg-[#1C1917]">
      {/* Painel esquerdo â€” decorativo */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-orange-700 via-orange-600 to-red-700 p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle at 30% 20%, white 1px, transparent 1px), radial-gradient(circle at 70% 80%, white 1px, transparent 1px)', backgroundSize:'60px 60px'}} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Wrench size={20} className="text-white" />
          </div>
          <span className="text-white font-black text-lg tracking-tight">AutoCenter Pro</span>
        </div>
        <div className="relative z-10">
          <h2 className="text-white text-4xl font-black leading-tight mb-4">GestÃ£o completa<br/>da sua oficina<br/>em um sÃ³ lugar.</h2>
          <p className="text-orange-100 text-sm leading-relaxed max-w-xs">Controle ordens de serviÃ§o, estoque, financeiro e equipe com eficiÃªncia e simplicidade.</p>
          <div className="flex gap-4 mt-8">
            {[['10+', 'MÃ³dulos'], ['100%', 'Online'], ['0', 'Papel']].map(([v, l]) => (
              <div key={l} className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 text-center border border-white/10">
                <p className="text-white font-black text-xl">{v}</p>
                <p className="text-orange-200 text-[10px] font-bold uppercase tracking-wider">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-orange-200/60 text-xs">Â© 2025 AutoCenter Pro. Todos os direitos reservados.</p>
      </div>

      {/* Painel direito â€” formulÃ¡rio */}
      <div className="flex-1 flex items-center justify-center p-6 bg-[#1C1917] lg:bg-slate-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center">
              <Wrench size={20} className="text-white" />
            </div>
            <span className="text-white lg:text-slate-800 font-black text-lg">AutoCenter Pro</span>
          </div>
          <h1 className="text-2xl font-black text-white lg:text-slate-800 mb-1">Bem-vindo de volta</h1>
          <p className="text-slate-400 lg:text-slate-500 text-sm mb-8">Entre com sua senha para continuar</p>
          <div className="relative mb-3">
            <input
              type={pwdVisible ? 'text' : 'password'}
              placeholder="Digite sua senha"
              value={pwdInput}
              onChange={e => { setPwdInput(e.target.value); setPwdError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              className={`w-full px-4 py-3.5 pr-12 rounded-xl outline-none text-sm font-medium transition-all border-2 bg-slate-800/50 lg:bg-white text-white lg:text-slate-800 placeholder-slate-500 lg:placeholder-slate-400 ${pwdError ? 'border-red-500' : 'border-slate-700 lg:border-slate-200 focus:border-orange-500'}`}
              autoFocus
            />
            <button type="button" onClick={() => setPwdVisible(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 lg:hover:text-slate-600 transition-colors">
              {pwdVisible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {pwdError && <p className="text-xs text-red-400 font-medium mb-3 flex items-center gap-1"><X size={12} />{pwdError}</p>}
          <p className="text-[11px] text-slate-500 mb-5">Senha padrÃ£o: <span className="font-bold text-slate-400 lg:text-slate-600">admin123</span></p>
          <button onClick={handleAdminLogin} className="w-full py-3.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-orange-900/30 active:scale-[.98]">
            Entrar no sistema
          </button>
        </div>
      </div>
    </div>
  );

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

      {/* â”€â”€ Overlay mobile â”€â”€ */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* â”€â”€ Sidebar â”€â”€ */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 flex flex-col
        transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:z-auto
        bg-[#1C1917]
      `}>
        {/* Logo */}
        <div className="px-5 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-900/50 flex-shrink-0">
              <Wrench size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-white leading-none">AutoCenter Pro</p>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Sistema de GestÃ£o</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-500 hover:text-white p-1 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Divisor */}
        <div className="mx-5 h-px bg-white/5 mb-4" />

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-3 py-2">Menu Principal</p>
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard"         active={activeTab} onClick={handleTabChange} />
          <NavItem id="services"  icon={Wrench}          label="ServiÃ§os"          active={activeTab} onClick={handleTabChange} />
          <NavItem id="quotes"    icon={FileText}        label="OrÃ§amentos"        active={activeTab} onClick={handleTabChange} />
          <NavItem id="clients"   icon={Users}           label="Clientes & Carros" active={activeTab} onClick={handleTabChange} />
          <NavItem id="staff"     icon={Briefcase}       label="Equipe"            active={activeTab} onClick={handleTabChange} />
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-3 py-2 mt-3">AnÃ¡lises</p>
          <NavItem id="reports"   icon={BarChart3}       label="RelatÃ³rios"        active={activeTab} onClick={handleTabChange} />
        </nav>

        {/* Footer */}
        <div className="p-3 m-3 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-600/20 flex items-center justify-center">
                <Lock size={11} className="text-orange-400" />
              </div>
              <span className="text-[11px] font-bold text-slate-300">Administrador</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setPwdError(''); setNewPwd(''); setConfirmPwd(''); setShowChangePwd(true); setSidebarOpen(false); }} className="text-slate-500 hover:text-slate-300 transition-colors p-1" title="Alterar senha">
                <KeyRound size={13} />
              </button>
              <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Sair">
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* â”€â”€ Main â”€â”€ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3.5 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-base font-black text-slate-800 leading-none">{getTabLabel(activeTab)}</h1>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5 hidden md:block">AutoCenter Pro Â· Sistema de GestÃ£o</p>
            </div>
          </div>
          {!['dashboard', 'reports'].includes(activeTab) && (
            <button
              onClick={() => { setModalType(getModalType(activeTab)); setFormData({ paymentMethod: 'Dinheiro', staffName: '' }); setShowModal(true); }}
              className="bg-orange-600 hover:bg-orange-500 active:scale-95 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md shadow-orange-200 transition-all text-sm"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">{getAddLabel(activeTab)}</span>
            </button>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">

          {/* â”€â”€ Dashboard â”€â”€ */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              {/* Stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatBox title="Faturamento Hoje"     value={formatBRL(reportData.daily.total)} icon={DollarSign} gradient="from-emerald-500 to-teal-600" />
                <StatBox title="ServiÃ§os Hoje"        value={String(reportData.daily.count)}    icon={Wrench}     gradient="from-orange-500 to-red-600" />
                <StatBox title="Profissionais Ativos" value={String(staff.length)}              icon={UserCircle} gradient="from-amber-500 to-rose-600" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Equipe */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-black text-slate-800">Equipe em Campo</h3>
                    <span className="text-[10px] font-bold bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full">{staff.length} ativos</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {staff.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <UserCircle size={18} className="text-white" />
                          </div>
                          <div>
                            <button onClick={() => setSelectedStaffName(s.name)} className="font-bold text-slate-800 text-sm hover:text-orange-600 transition-colors text-left">{s.name}</button>
                            <p className="text-[10px] text-slate-400 font-medium">{s.specialty || 'MecÃ¢nico Geral'}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full border border-emerald-100">â— Ativo</span>
                      </div>
                    ))}
                    {staff.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Nenhum profissional cadastrado.</p>}
                  </div>
                </div>

                {/* Ãšltimas OS */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-black text-slate-800">Ãšltimas Ordens</h3>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">{services.length} total</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {services.slice(-5).reverse().map(s => (
                      <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status === 'Entregue' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">{s.description}</p>
                            <p className="text-[10px] text-slate-400 font-medium truncate">
                              {s.clientName}{s.staffName ? ` Â· ${s.staffName}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 ml-3 flex-shrink-0">
                          <span className="font-black text-slate-700 text-xs">{formatBRL(s.value)}</span>
                          <span className="text-[9px] text-slate-400">{s.date}</span>
                        </div>
                      </div>
                    ))}
                    {services.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Nenhum serviÃ§o registado.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* â”€â”€ RelatÃ³rios â”€â”€ */}
          {activeTab === 'reports' && (() => {
            const todayStr = new Date().toISOString().split('T')[0];
            const mesAtual = todayStr.substring(0, 7);
            const servicosFiltrados = reportPeriod === 'mes'
              ? services.filter(s => s.date?.substring(0, 7) === mesAtual)
              : services;

            // Agrupar serviÃ§os por mecÃ¢nico
            const porMecanico: Record<string, Service[]> = {};
            servicosFiltrados.forEach(s => {
              const nome = s.staffName || 'Sem MecÃ¢nico';
              if (!porMecanico[nome]) porMecanico[nome] = [];
              porMecanico[nome].push(s);
            });

            return (
              <div className="space-y-6">
                {/* Totais */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatBox title={reportPeriod === 'mes' ? 'Faturamento do MÃªs' : 'Faturamento Total'} value={formatBRL(servicosFiltrados.reduce((a, s) => a + (s.value ?? 0), 0))} icon={DollarSign} color="text-emerald-500" />
                  <StatBox title={reportPeriod === 'mes' ? 'ServiÃ§os no MÃªs' : 'Total de ServiÃ§os'} value={String(servicosFiltrados.length)} icon={Wrench} color="text-orange-500" />
                  <StatBox title="MecÃ¢nicos Ativos" value={String(Object.keys(porMecanico).length)} icon={UserCircle} color="text-purple-500" />
                </div>

                {/* Filtro de perÃ­odo */}
                <div className="flex items-center gap-2">
                  {(['mes', 'tudo'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setReportPeriod(p)}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${reportPeriod === p ? 'bg-orange-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-500 hover:border-orange-300'}`}
                    >
                      {p === 'mes' ? 'ðŸ“… Este MÃªs' : 'ðŸ“‚ Todo o PerÃ­odo'}
                    </button>
                  ))}
                </div>

                {/* HistÃ³rico por mecÃ¢nico (acordeÃ£o) */}
                <div className="space-y-3">
                  <h3 className="text-base font-black flex items-center gap-2 text-slate-800">
                    <Briefcase size={18} className="text-orange-500" /> HistÃ³rico por MecÃ¢nico
                  </h3>
                  {Object.keys(porMecanico).length === 0 && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
                      Nenhum serviÃ§o encontrado no perÃ­odo.
                    </div>
                  )}
                  {Object.entries(porMecanico)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([nome, svcs]) => {
                      const totalMec = svcs.reduce((a, s) => a + (s.value ?? 0), 0);
                      const isOpen = expandedStaff === nome;
                      return (
                        <div key={nome} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                          {/* CabeÃ§alho do mecÃ¢nico */}
                          <button
                            onClick={() => setExpandedStaff(isOpen ? null : nome)}
                            className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 transition-colors text-left"
                          >

                            <div className="flex items-center gap-3">
                              <div className="bg-orange-100 text-orange-600 p-2.5 rounded-xl flex-shrink-0">
                                <UserCircle size={20} />
                              </div>
                              <div>
                                <p className="font-black text-slate-800 text-sm">{nome}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {svcs.length} serviÃ§o{svcs.length !== 1 ? 's' : ''} Â· {formatBRL(totalMec)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="hidden sm:block font-black text-emerald-600 text-sm">{formatBRL(totalMec)}</span>
                              <span className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>â–¼</span>
                            </div>
                          </button>

                          {/* Lista de serviÃ§os do mecÃ¢nico */}
                          {isOpen && (
                            <div className="border-t border-slate-100">
                              {/* Header desktop */}
                              <div className="hidden md:grid grid-cols-5 gap-3 px-5 py-2 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <span className="col-span-2">ServiÃ§o Â· Cliente</span>
                                <span>Placa</span>
                                <span>Data</span>
                                <span className="text-right">Valor Â· Status</span>
                              </div>
                              {svcs
                                .slice()
                                .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                                .map(s => (
                                  <div key={s.id} className="px-4 md:px-5 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    {/* Mobile */}
                                    <div className="md:hidden">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <p className="font-bold text-slate-800 text-sm truncate">{s.description}</p>
                                          {s.clientName && <p className="text-xs text-slate-500 truncate">ðŸ‘¤ {s.clientName}{s.plate ? ` Â· ${s.plate}` : ''}</p>}
                                        </div>
                                        <StatusBadge status={s.status} paymentMethod={s.paymentMethod} />
                                      </div>
                                      <div className="flex items-center justify-between mt-1.5">
                                        <span className="text-[10px] text-slate-400 font-bold">ðŸ“… {s.date || 'â€”'}</span>
                                        <span className="font-black text-orange-600 text-sm">{formatBRL(s.value)}</span>
                                      </div>
                                    </div>
                                    {/* Desktop */}
                                    <div className="hidden md:grid grid-cols-5 gap-3 items-center">
                                      <div className="col-span-2 min-w-0">
                                        <p className="font-bold text-slate-800 text-sm truncate">{s.description}</p>
                                        {s.clientName && <p className="text-xs text-slate-400 truncate">{s.clientName}</p>}
                                      </div>
                                      <span className="text-xs font-bold text-slate-500">{s.plate || 'â€”'}</span>
                                      <span className="text-xs font-bold text-slate-500">{s.date || 'â€”'}</span>
                                      <div className="flex items-center justify-end gap-2">
                                        <span className="font-black text-orange-600 text-sm">{formatBRL(s.value)}</span>
                                        <StatusBadge status={s.status} paymentMethod={s.paymentMethod} />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* â”€â”€ Tabela detalhada por mecÃ¢nico â”€â”€ */}
                <div className="space-y-3">
                  <h3 className="text-base font-black flex items-center gap-2 text-slate-800">
                    <FileText size={18} className="text-emerald-500" /> Tabela Detalhada por MecÃ¢nico
                  </h3>

                  {/* Filtros de data */}
                  <div className="flex flex-wrap gap-3 items-center bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Filtrar por data:</span>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-500">De</label>
                      <input
                        type="date"
                        value={reportDateFrom}
                        onChange={e => setReportDateFrom(e.target.value)}
                        className="p-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-orange-400"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-500">AtÃ©</label>
                      <input
                        type="date"
                        value={reportDateTo}
                        onChange={e => setReportDateTo(e.target.value)}
                        className="p-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-orange-400"
                      />
                    </div>
                    {(reportDateFrom || reportDateTo) && (
                      <button
                        onClick={() => { setReportDateFrom(''); setReportDateTo(''); }}
                        className="text-xs font-bold text-red-400 hover:text-red-600 transition-colors"
                      >
                        Limpar
                      </button>
                    )}
                  </div>

                  {/* Tabela agrupada por mecÃ¢nico */}
                  {(() => {
                    const filteredByDate = servicosFiltrados.filter(s => {
                      if (reportDateFrom && (s.date || '') < reportDateFrom) return false;
                      if (reportDateTo && (s.date || '') > reportDateTo) return false;
                      return true;
                    });
                    const grouped: Record<string, Service[]> = {};
                    filteredByDate.forEach(s => {
                      const n = s.staffName || 'Sem MecÃ¢nico';
                      if (!grouped[n]) grouped[n] = [];
                      grouped[n].push(s);
                    });
                    if (filteredByDate.length === 0) return (
                      <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
                        Nenhum serviÃ§o encontrado para o perÃ­odo selecionado.
                      </div>
                    );
                    return Object.entries(grouped)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([nome, svcs]) => {
                        const totalMec = svcs.reduce((a, s) => a + (s.value ?? 0), 0);
                        const svcsSorted = [...svcs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                        return (
                          <div key={nome} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            {/* Nome do mecÃ¢nico */}
                            <div className="flex items-center justify-between px-5 py-3 bg-slate-800">
                              <div className="flex items-center gap-2">
                                <UserCircle size={16} className="text-orange-300" />
                                <span className="font-black text-white text-sm">{nome}</span>
                                <span className="text-slate-400 text-xs">â€” {svcs.length} serviÃ§o{svcs.length !== 1 ? 's' : ''}</span>
                              </div>
                              <span className="font-black text-emerald-400 text-sm">{formatBRL(totalMec)}</span>
                            </div>
                            {/* Header da tabela */}
                            <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-2 bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              <span className="col-span-1">Data</span>
                              <span className="col-span-4">ServiÃ§o / DescriÃ§Ã£o</span>
                              <span className="col-span-3">Cliente</span>
                              <span className="col-span-2">Placa</span>
                              <span className="col-span-1 text-right">Valor</span>
                              <span className="col-span-1 text-right">Status</span>
                            </div>
                            {/* Linhas */}
                            {svcsSorted.map(s => (
                              <div key={s.id} className="px-4 md:px-5 py-3 border-b border-slate-50 last:border-0 hover:bg-orange-50/30 transition-colors">
                                {/* Mobile */}
                                <div className="md:hidden space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg">ðŸ“… {s.date || 'â€”'}</span>
                                    <StatusBadge status={s.status} paymentMethod={s.paymentMethod} />
                                  </div>
                                  <p className="font-bold text-slate-800 text-sm">{s.description}</p>
                                  <p className="text-xs text-slate-500">ðŸ‘¤ {s.clientName || 'â€”'}{s.plate ? ` Â· ${s.plate}` : ''}</p>
                                  <p className="font-black text-orange-600 text-sm">{formatBRL(s.value)}</p>
                                </div>
                                {/* Desktop */}
                                <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                                  <span className="col-span-1 text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-lg text-center">{s.date || 'â€”'}</span>
                                  <div className="col-span-4 min-w-0">
                                    <p className="font-bold text-slate-800 text-sm truncate">{s.description}</p>
                                  </div>
                                  <span className="col-span-3 text-xs text-slate-500 truncate">{s.clientName || 'â€”'}</span>
                                  <span className="col-span-2 text-xs font-bold text-slate-500">{s.plate || 'â€”'}</span>
                                  <span className="col-span-1 text-right font-black text-orange-600 text-sm">{formatBRL(s.value)}</span>
                                  <div className="col-span-1 flex justify-end">
                                    <StatusBadge status={s.status} paymentMethod={s.paymentMethod} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      });
                  })()}
                </div>

              </div>
            );
          })()}

          {/* â”€â”€ OrÃ§amentos â”€â”€ */}
          {activeTab === 'quotes' && (
            <div className="space-y-4">
              {/* Mobile search */}
              <div className="md:hidden bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center p-3">
                <Search className="text-slate-300 mr-2 flex-shrink-0" size={18} />
                <input
                  placeholder="Procurar orÃ§amentos..."
                  className="bg-transparent outline-none w-full font-medium text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {quotes.filter(q => JSON.stringify(q).toLowerCase().includes(searchTerm.toLowerCase())).map(q => (
                  <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-slate-800 truncate">{q.clientName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{q.vehicleModel || 'â€”'} {q.vehiclePlate ? `Â· ${q.vehiclePlate}` : ''}</p>
                      </div>
                      <QuoteStatusBadge status={q.status} />
                    </div>
                    <p className="text-lg font-black text-orange-600 mb-3">{formatBRL(q.total)}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => printQuote(q)} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-bold py-2 rounded-xl hover:bg-slate-200 transition-colors">
                        <Printer size={13} /> PDF
                      </button>
                      <button onClick={() => shareWhatsApp(q)} className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 text-green-700 text-xs font-bold py-2 rounded-xl hover:bg-green-100 transition-colors">
                        <WhatsAppIcon size={13} /> WhatsApp
                      </button>
                      <button onClick={() => openEditQuote(q)} className="flex-1 flex items-center justify-center gap-1.5 bg-orange-50 text-orange-700 text-xs font-bold py-2 rounded-xl hover:bg-orange-100 transition-colors">
                        <Pencil size={13} /> Editar
                      </button>
                      {q.status === 'Pendente' && (
                        <>
                          <button onClick={() => changeQuoteStatus(q.id, 'Aprovado')} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold py-2 rounded-xl hover:bg-emerald-100 transition-colors">
                            <ThumbsUp size={13} /> Aprovar
                          </button>
                          <button onClick={() => changeQuoteStatus(q.id, 'Recusado')} className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 text-red-600 text-xs font-bold py-2 rounded-xl hover:bg-red-100 transition-colors">
                            <ThumbsDown size={13} /> Recusar
                          </button>
                        </>
                      )}
                      <button onClick={() => deleteQuote(q.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {quotes.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">Nenhum orÃ§amento ainda. Crie o primeiro!</p>}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b flex items-center bg-slate-50/50">
                  <Search className="text-slate-300 mr-2 flex-shrink-0" size={18} />
                  <input placeholder="Procurar orÃ§amentos..." className="bg-transparent outline-none w-full font-medium text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                    <tr>
                      <th className="p-5">Cliente</th>
                      <th className="p-5">VeÃ­culo / Placa</th>
                      <th className="p-5">Total</th>
                      <th className="p-5">Status</th>
                      <th className="p-5 text-right">AÃ§Ãµes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {quotes.filter(q => JSON.stringify(q).toLowerCase().includes(searchTerm.toLowerCase())).map(q => (
                      <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-5 font-bold text-slate-800 text-sm">{q.clientName}</td>
                        <td className="p-5 text-sm text-slate-500">{q.vehicleModel || 'â€”'}{q.vehiclePlate ? ` Â· ${q.vehiclePlate}` : ''}</td>
                        <td className="p-5 font-black text-orange-600 text-sm">{formatBRL(q.total)}</td>
                        <td className="p-5"><QuoteStatusBadge status={q.status} /></td>
                        <td className="p-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => printQuote(q)} title="Gerar PDF" className="flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-slate-200 transition-colors">
                              <Printer size={14} /> PDF
                            </button>
                            <button onClick={() => shareWhatsApp(q)} title="Enviar via WhatsApp" className="flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-green-100 transition-colors">
                              <WhatsAppIcon size={14} /> WhatsApp
                            </button>
                            <button onClick={() => openEditQuote(q)} title="Editar" className="flex items-center gap-1.5 bg-orange-50 text-orange-700 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-orange-100 transition-colors">
                              <Pencil size={14} /> Editar
                            </button>
                            {q.status === 'Pendente' && (
                              <>
                                <button onClick={() => changeQuoteStatus(q.id, 'Aprovado')} className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-colors">
                                  <ThumbsUp size={13} /> Aprovar
                                </button>
                                <button onClick={() => changeQuoteStatus(q.id, 'Recusado')} className="flex items-center gap-1 bg-red-50 text-red-600 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-red-100 transition-colors">
                                  <ThumbsDown size={13} /> Recusar
                                </button>
                              </>
                            )}
                            <button onClick={() => deleteQuote(q.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={17} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {quotes.length === 0 && (
                      <tr><td colSpan={5} className="p-10 text-center text-slate-400 text-sm">Nenhum orÃ§amento registado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* â”€â”€ Tabela / Cards â”€â”€ */}
          {(['services', 'staff', 'vehicles', 'customers', 'clients'] as TabName[]).includes(activeTab) && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Barra de pesquisa */}
              <div className="p-3 md:p-4 border-b flex items-center bg-slate-50/50">
                <Search className="text-slate-300 mr-2 flex-shrink-0" size={18} />
                <input
                  placeholder={activeTab === 'services' ? 'Buscar por cliente, placa ou serviÃ§o...' : activeTab === 'clients' ? 'Buscar por nome, placa ou veÃ­culo...' : 'Procurar na base...'}
                  className="bg-transparent outline-none w-full font-medium text-sm"
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              {/* Filtros rÃ¡pidos de status (apenas serviÃ§os) */}
              {activeTab === 'services' && (
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-slate-50/30 overflow-x-auto">
                  {(['Todos', 'Pendente', 'Entregue'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setServiceFilter(f)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black transition-all ${
                        serviceFilter === f
                          ? f === 'Todos'    ? 'bg-slate-800 text-white'
                          : f === 'Pendente' ? 'bg-amber-500 text-white'
                                             : 'bg-emerald-500 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {f === 'Todos' ? `Todos (${services.length})` : f === 'Pendente' ? `Pendentes (${services.filter(s => s.status === 'Pendente').length})` : `Entregues (${services.filter(s => s.status === 'Entregue').length})`}
                    </button>
                  ))}
                </div>
              )}
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {tableData.map(item => {
                  const cells = getTableCells(item);
                  const isSvc = activeTab === 'services';
                  const svc = isSvc ? (item as Service) : null;
                  return (
                    <div key={item.id} className="flex items-center justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 text-sm truncate">{cells[0]}</p>
                        {isSvc && svc
                          ? <div className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1">
                              {svc.plate && <span>{svc.plate} Â·</span>}
                              {svc.staffName
                                ? <button onClick={() => setSelectedStaffName(svc.staffName)} className="hover:text-orange-600 active:text-orange-700 transition-colors font-bold truncate text-left">{svc.staffName}</button>
                                : <span>Sem mecÃ¢nico</span>
                              }
                            </div>
                          : <p className="text-xs text-slate-500 mt-0.5 truncate">{cells[1]}</p>
                        }
                        {isSvc && svc
                          ? <div className="mt-1"><StatusBadge status={svc.status} paymentMethod={svc.paymentMethod} /></div>
                          : <p className="text-[10px] text-slate-400 mt-0.5 uppercase font-bold">{cells[2]}</p>
                        }
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        {isSvc && svc && svc.status === 'Pendente' && (
                          <button
                            onClick={() => openDelivery(item.id)}
                            className="flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl hover:bg-emerald-600 transition-colors"
                          >
                            <CheckCircle size={12} /> Entregar
                          </button>
                        )}
                        <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {tableData.length === 0 && <p className="p-8 text-center text-slate-400 text-sm">Nenhum registo encontrado.</p>}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                    <tr>
                      {tableHeaders.map((h, i) => <th key={i} className="p-6">{h}</th>)}
                      <th className="p-6 text-right">AÃ§Ã£o</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tableData.map(item => {
                      const cells = getTableCells(item);
                      const isSvc = activeTab === 'services';
                      const svc = isSvc ? (item as Service) : null;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          {cells.map((cell, i) => (
                            <td key={i} className={`p-6 text-sm ${i === 0 ? 'font-bold text-slate-800' : 'font-medium text-slate-500'}`}>
                              {isSvc && i === 2 && svc
                                ? <StatusBadge status={svc.status} paymentMethod={svc.paymentMethod} />
                                : isSvc && i === 1 && svc
                                  ? <span className="flex items-center gap-1">
                                      {svc.plate && <span>{svc.plate} Â·</span>}
                                      {svc.staffName
                                        ? <button onClick={() => setSelectedStaffName(svc.staffName)} className="hover:text-orange-600 active:text-orange-700 transition-colors font-bold text-left">{svc.staffName}</button>
                                        : <span>Sem mecÃ¢nico</span>
                                      }
                                    </span>
                                  : cell}
                            </td>
                          ))}
                          <td className="p-6 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {isSvc && svc && svc.status === 'Pendente' && (
                                <button
                                  onClick={() => openDelivery(item.id)}
                                  className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-black px-3 py-1.5 rounded-xl hover:bg-emerald-600 transition-colors"
                                >
                                  <CheckCircle size={14} /> Entregar
                                </button>
                              )}
                              <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {tableData.length === 0 && (
                      <tr><td colSpan={4} className="p-10 text-center text-slate-400 text-sm">Nenhum registo encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* â”€â”€ Bottom Nav (mobile) â”€â”€ */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-30 shadow-lg">
          <BottomNavItem id="dashboard" icon={LayoutDashboard} label="Home"       active={activeTab} onClick={handleTabChange} />
          <BottomNavItem id="services"  icon={Wrench}          label="ServiÃ§os"   active={activeTab} onClick={handleTabChange} />
          <BottomNavItem id="quotes"    icon={FileText}        label="OrÃ§amentos" active={activeTab} onClick={handleTabChange} />
          <BottomNavItem id="clients"   icon={Users}           label="Clientes"   active={activeTab} onClick={handleTabChange} />
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex-1 flex flex-col items-center justify-center py-3 text-slate-400 hover:text-white transition-colors"
          >
            <Menu size={20} />
            <span className="text-[9px] mt-1 font-bold">Menu</span>
          </button>
        </nav>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          MODAL ALTERAR SENHA
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {showChangePwd && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-[60]">
          <div className="bg-white rounded-t-3xl md:rounded-[32px] p-6 md:p-10 w-full md:max-w-sm shadow-2xl">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6 md:hidden" />

            <div className="flex flex-col items-center mb-6">
              <div className="bg-slate-800 p-4 rounded-2xl mb-4">
                <KeyRound size={24} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-slate-800">Alterar Senha</h2>
              <p className="text-sm text-slate-400 mt-1 text-center">Defina uma nova senha para o acesso admin</p>
            </div>

            <div className="space-y-3 mb-4">
              <div className="relative">
                <input
                  type={newPwdVisible ? 'text' : 'password'}
                  placeholder="Nova senha (mÃ­n. 4 caracteres)"
                  value={newPwd}
                  onChange={e => { setNewPwd(e.target.value); setPwdError(''); }}
                  className="w-full p-4 pr-12 bg-slate-50 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-orange-400"
                />
                <button type="button" onClick={() => setNewPwdVisible(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {newPwdVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <input
                type={newPwdVisible ? 'text' : 'password'}
                placeholder="Confirmar nova senha"
                value={confirmPwd}
                onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {pwdError && (
              <p className="text-xs text-red-500 font-bold mb-4 flex items-center gap-1">
                <X size={12} /> {pwdError}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setShowChangePwd(false); setPwdError(''); }} className="flex-1 p-4 font-bold text-slate-400 hover:text-slate-600 transition-colors text-sm">
                Cancelar
              </button>
              <button onClick={handleChangePassword} className="flex-1 p-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-900 transition-all text-sm">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Modal de registo (OS / VeÃ­culo / etc) â”€â”€ */}
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
          MODAL HISTÃ“RICO DO MECÃ‚NICO
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
                              <p className="text-xs text-slate-500 mt-0.5 truncate">ðŸ‘¤ {s.clientName}{s.plate ? ` Â· ${s.plate}` : ''}</p>
                            )}
                            <p className="text-[10px] text-slate-400 font-bold mt-1">ðŸ“… {s.date || 'â€”'}</p>
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


