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
    staff: 'Novo Mecânico', vehicles: 'Novo Veículo', customers: 'Novo Cliente', quotes: 'Novo Orçamento', clients: 'Novo Cadastro',
  };
  return map[tab] ?? 'Nova OS';
};
const getTabLabel = (tab: TabName) => {
  const map: Record<TabName, string> = {
    dashboard: 'Dashboard', services: 'Serviços', quotes: 'Orçamentos',
    clients: 'Clientes & Carros', staff: 'Equipa', reports: 'Relatórios',
    vehicles: 'Veículos', customers: 'Clientes',
  };
  return map[tab] ?? tab;
};
const formatBRL = (val?: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val ?? 0);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const App: React.FC = () => {
  // ── Auth state ──
  const [isAuthenticated, setIsAuthenticated] = useState(isAuthValid);
  const [showChangePwd,   setShowChangePwd]    = useState(false);
  const [pwdInput,        setPwdInput]         = useState('');
  const [pwdVisible,      setPwdVisible]       = useState(false);
  const [pwdError,        setPwdError]         = useState('');
  const [newPwd,          setNewPwd]           = useState('');
  const [confirmPwd,      setConfirmPwd]       = useState('');
  const [newPwdVisible,   setNewPwdVisible]    = useState(false);

  // ── App state ──
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

  // ── Entrega de serviço ──
  const [showDeliveryModal,   setShowDeliveryModal]   = useState(false);
  const [deliveryServiceId,   setDeliveryServiceId]   = useState<string | null>(null);
  const [deliveryPayment,     setDeliveryPayment]     = useState('Dinheiro');

  // ── Orçamentos ──
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
        { id: 's1', name: 'Carlos Augusto',   specialty: 'Motor e Injeção',     createdAt: ts(90) },
        { id: 's2', name: 'Rodrigo Ferreira', specialty: 'Freios e Suspensão',  createdAt: ts(85) },
        { id: 's3', name: 'Leandro Souza',    specialty: 'Elétrica Automotiva', createdAt: ts(70) },
        { id: 's4', name: 'Fábio Mendes',     specialty: 'Funilaria e Pintura', createdAt: ts(60) },
      ];
      const demoClients: ClientRecord[] = [
        { id: 'c1', name: 'Marcos Oliveira',    phone: '(21) 99812-3344', vehicleModel: 'Chevrolet Onix 2021',  vehiclePlate: 'RJA-2E34', arrivedAt: d(1),  createdAt: ts(1)  },
        { id: 'c2', name: 'Patrícia Mendonça',  phone: '(21) 97654-8821', vehicleModel: 'Volkswagen Polo 2022', vehiclePlate: 'RJB-4F12', arrivedAt: d(3),  createdAt: ts(3)  },
        { id: 'c3', name: 'André Lima',         phone: '(21) 98345-1177', vehicleModel: 'Fiat Strada 2020',     vehiclePlate: 'RJC-7H90', arrivedAt: d(5),  createdAt: ts(5)  },
        { id: 'c4', name: 'Fernanda Costa',     phone: '(21) 96781-5502', vehicleModel: 'Toyota Corolla 2023',  vehiclePlate: 'RJD-9K55', arrivedAt: d(8),  createdAt: ts(8)  },
        { id: 'c5', name: 'Roberto Nascimento', phone: '(21) 99234-6610', vehicleModel: 'Hyundai HB20 2021',    vehiclePlate: 'RJE-1M78', arrivedAt: d(12), createdAt: ts(12) },
        { id: 'c6', name: 'Juliana Ramos',      phone: '(21) 98876-3345', vehicleModel: 'Chevrolet Cruze 2019', vehiclePlate: 'RJF-3N21', arrivedAt: d(18), createdAt: ts(18) },
        { id: 'c7', name: 'Diego Cardoso',      phone: '(21) 97112-8890', vehicleModel: 'Ford Ka 2020',         vehiclePlate: 'RJG-5P44', arrivedAt: d(25), createdAt: ts(25) },
      ];
      const demoServices: Service[] = [
        { id: 'sv1',  description: 'Revisão completa 30.000 km',        clientName: 'Marcos Oliveira',    plate: 'RJA-2E34', staffName: 'Carlos Augusto',   paymentMethod: 'Pix',      status: 'Pendente', value: 380,  date: d(0),  createdAt: ts(0)  },
        { id: 'sv2',  description: 'Troca de pastilhas de freio',        clientName: 'Patrícia Mendonça',  plate: 'RJB-4F12', staffName: 'Rodrigo Ferreira', paymentMethod: 'Pix',      status: 'Pendente', value: 240,  date: d(1),  createdAt: ts(1)  },
        { id: 'sv3',  description: 'Diagnóstico elétrico + bateria',     clientName: 'André Lima',         plate: 'RJC-7H90', staffName: 'Leandro Souza',    paymentMethod: 'Dinheiro', status: 'Entregue', value: 310,  date: d(2),  createdAt: ts(2)  },
        { id: 'sv4',  description: 'Alinhamento e balanceamento',        clientName: 'Fernanda Costa',     plate: 'RJD-9K55', staffName: 'Rodrigo Ferreira', paymentMethod: 'Cartão',   status: 'Entregue', value: 160,  date: d(3),  createdAt: ts(3)  },
        { id: 'sv5',  description: 'Troca de óleo e filtros',            clientName: 'Roberto Nascimento', plate: 'RJE-1M78', staffName: 'Carlos Augusto',   paymentMethod: 'Dinheiro', status: 'Entregue', value: 210,  date: d(4),  createdAt: ts(4)  },
        { id: 'sv6',  description: 'Reparo sistema de injeção eletrônica', clientName: 'Juliana Ramos',   plate: 'RJF-3N21', staffName: 'Carlos Augusto',   paymentMethod: 'Pix',      status: 'Entregue', value: 490,  date: d(5),  createdAt: ts(5)  },
        { id: 'sv7',  description: 'Funilaria – amasso porta dianteira',  clientName: 'Diego Cardoso',     plate: 'RJG-5P44', staffName: 'Fábio Mendes',     paymentMethod: 'Cartão',   status: 'Entregue', value: 850,  date: d(7),  createdAt: ts(7)  },
        { id: 'sv8',  description: 'Troca amortecedores traseiros',       clientName: 'Marcos Oliveira',   plate: 'RJA-2E34', staffName: 'Rodrigo Ferreira', paymentMethod: 'Pix',      status: 'Entregue', value: 620,  date: d(10), createdAt: ts(10) },
        { id: 'sv9',  description: 'Limpeza de bicos injetores',          clientName: 'Fernanda Costa',    plate: 'RJD-9K55', staffName: 'Carlos Augusto',   paymentMethod: 'Dinheiro', status: 'Entregue', value: 280,  date: d(12), createdAt: ts(12) },
        { id: 'sv10', description: 'Instalação de som automotivo',        clientName: 'André Lima',        plate: 'RJC-7H90', staffName: 'Leandro Souza',    paymentMethod: 'Cartão',   status: 'Entregue', value: 420,  date: d(15), createdAt: ts(15) },
      ];
      const demoQuotes: Quote[] = [
        { id: 'q1', clientName: 'Roberto Nascimento', vehicleModel: 'Hyundai HB20 2021', vehiclePlate: 'RJE-1M78', phone: '(21) 99234-6610', email: '', address: 'Rua das Flores, 142', km: '48.200', yearModel: '2021/2022', discount: 50, items: [{ description: 'Troca de correia dentada + tensor', qty: 1, unitValue: 380 }, { description: 'Fluido de freio DOT 4', qty: 1, unitValue: 65 }, { description: 'Mão de obra', qty: 1, unitValue: 200 }], total: 595, status: 'Pendente', observations: 'Cliente relata barulho ao frear.', paymentConditions: '50% entrada + saldo na retirada', validDays: '7', createdAt: ts(1) },
        { id: 'q2', clientName: 'Juliana Ramos', vehicleModel: 'Chevrolet Cruze 2019', vehiclePlate: 'RJF-3N21', phone: '(21) 98876-3345', email: 'juliana@email.com', address: 'Av. Principal, 800', km: '72.500', yearModel: '2019/2020', discount: 0, items: [{ description: 'Revisão geral 70.000 km', qty: 1, unitValue: 420 }, { description: 'Troca de velas de ignição', qty: 4, unitValue: 45 }, { description: 'Filtro de ar', qty: 1, unitValue: 80 }], total: 680, status: 'Aprovado', observations: '', paymentConditions: 'À vista no PIX', validDays: '10', createdAt: ts(4) },
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
        ...oldVehicles.map(v => ({ id: v.id, createdAt: v.createdAt, name: v.model || 'Veículo', vehicleModel: v.model, vehiclePlate: v.plate || '', arrivedAt: v.createdAt?.substring(0, 10) || '' })),
      ];
      if (migrated.length > 0) { saveCol('clientrecords', migrated); setClientRecords(migrated); }
    }
    setLoading(false);
  }, []);

  // ── Auth actions ──
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
      setPwdError('As senhas não coincidem.');
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

  // ── Reports ──
  const reportData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const calcStats = (list: Service[]) => {
      const total = list.reduce((acc, curr) => acc + (curr.value ?? 0), 0);
      const staffPerf = list.reduce<Record<string, { count: number; total: number }>>(
        (acc, curr) => {
          const name = curr.staffName || 'Não Atribuído';
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

  // ── CRUD ──
  const handleSave = () => {
    // Validação básica
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

  // ── Entregar serviço (atualiza status + pagamento) ──
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

  // ── Orçamento: abrir edição ──
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

  // ── Orçamento: salvar (criar ou editar) ──
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

  // ── Orçamento: mudar status ──
  const changeQuoteStatus = (id: string, status: Quote['status']) => {
    const updated = quotes.map(q => q.id === id ? { ...q, status } : q);
    setQuotes(updated);
    saveCol('quotes', updated);
  };

  // ── Orçamento: deletar ──
  const deleteQuote = (id: string) => {
    const updated = quotes.filter(q => q.id !== id);
    setQuotes(updated);
    saveCol('quotes', updated);
  };

  // ── Orçamento: gerar PDF (abre janela de impressão) ──
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
      <title>Nota de Orçamento – Gilmar Auto Center</title>
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
          <div class="logo-sub">— SISTEMA DE GESTÃO —</div>
        </div>
        <div class="header-right">
          <div class="nota-title">Nota de Orçamento</div>
          <table class="header-fields">
            <tr><td>Nº do Orçamento:</td><td>${quoteNum}</td></tr>
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
          <span class="client-label">Endereço:</span>
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
            <div class="client-sub"><span class="client-label">Veículo:</span><span class="client-value">${quote.vehicleModel ?? ''}</span></div>
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
              <th>Descrição dos Serviços / Peças</th>
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

      <!-- RODAPÉ: observações + totais -->
      <div class="footer-section">
        <div class="footer-left">
          <span class="fl-label">Observações:</span>
          <div class="obs-line">${quote.observations ?? ''}</div>
          <div class="obs-line"></div>
          <div class="obs-line"></div>
          <br>
          <span class="fl-label">Condições de Pagamento:</span>
          <div class="pagamento-line">${quote.paymentConditions ?? ''}</div>
          <div class="validade">Orçamento válido por <u>&nbsp;&nbsp;${quote.validDays ?? '___'}&nbsp;&nbsp;</u> dias.</div>
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
          <div class="bottom-item"><span class="bottom-icon">🔧</span><span><b>AutoCenter Pro</b> — Sistema de Gestão</span></div>
        </div>
        <div class="bottom-item"><span class="bottom-icon">📋</span><div>Documento gerado automaticamente pelo sistema</div></div>
      </div>

      <script>window.onload=()=>{window.print()}<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  // ── Orçamento: enviar via WhatsApp ──
  const shareWhatsApp = (quote: Quote) => {
    const num = `#${quote.id.slice(-6).toUpperCase()}`;
    const data = new Date(quote.createdAt).toLocaleDateString('pt-BR');
    const itens = quote.items
      .map(i => `  • ${i.description} (${i.qty}x) — ${formatBRL(i.qty * i.unitValue)}`)
      .join('\n');
    const veiculo = [quote.vehicleModel, quote.vehiclePlate].filter(Boolean).join(' · ');
    const msg = [
      `🔧 *Orçamento AutoCenter Pro* ${num}`,
      `📅 Data: ${data}`,
      ``,
      `👤 Cliente: *${quote.clientName}*`,
      veiculo ? `🚗 Veículo: ${veiculo}` : '',
      ``,
      `📋 *Serviços / Itens:*`,
      itens,
      ``,
      `💰 *Total: ${formatBRL(quote.total)}*`,
      ``,
      `📞 Entre em contato conosco para mais informações.`,
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
    if (activeTab === 'clients')  return ['Cliente · Telefone', 'Veículo · Placa', 'Chegada'];
    return ['Serviço / Cliente', 'Placa · Mecânico', 'Status'];
  };
  const getTableCells = (item: BaseItem) => {
    if (activeTab === 'staff')     { const s = item as Staff;     return [s.name, s.specialty || '-', s.createdAt?.substring(0,10) || '-']; }
    if (activeTab === 'vehicles')  { const v = item as Vehicle;   return [v.model, v.plate || '-', v.createdAt?.substring(0,10) || '-']; }
    if (activeTab === 'customers') { const c = item as Customer;  return [c.name, c.phone || '-', c.createdAt?.substring(0,10) || '-']; }
    if (activeTab === 'clients') {
      const cr = item as ClientRecord;
      const namePhone = cr.phone ? `${cr.name}  ·  ${cr.phone}` : cr.name;
      const vehicleInfo = [cr.vehicleModel, cr.vehiclePlate].filter(Boolean).join('  ·  ') || '—';
      return [namePhone, vehicleInfo, cr.arrivedAt || '—'];
    }
    const sv = item as Service;
    const svcTitle = sv.clientName ? `${sv.description} · ${sv.clientName}` : sv.description;
    const svcSub   = [sv.plate, sv.staffName || 'Sem mecânico'].filter(Boolean).join(' · ');
    return [svcTitle, svcSub, sv.status || 'Pendente'];
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
      <Loader2 className="animate-spin" size={32} />
    </div>
  );

  // ── Tela de login (acesso bloqueado sem senha) ──
  if (!isAuthenticated) return (
    <div className="h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-white rounded-3xl p-8 md:p-10 w-full max-w-sm shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-200">
            <Wrench size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">AutoCenter Pro</h1>
          <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Sistema de Gestão</p>
        </div>
        <div className="relative mb-4">
          <input
            type={pwdVisible ? 'text' : 'password'}
            placeholder="Senha"
            value={pwdInput}
            onChange={e => { setPwdInput(e.target.value); setPwdError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
            className={`w-full p-4 pr-12 bg-slate-50 rounded-2xl outline-none font-bold text-sm transition-all ${pwdError ? 'ring-2 ring-red-400 bg-red-50' : 'focus:ring-2 focus:ring-blue-400'}`}
            autoFocus
          />
          <button type="button" onClick={() => setPwdVisible(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {pwdVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {pwdError && (
          <p className="text-xs text-red-500 font-bold mb-4 flex items-center gap-1"><X size={12} />{pwdError}</p>
        )}
        <p className="text-[10px] text-slate-400 mb-6 text-center">Senha padrão: <span className="font-black text-slate-500">admin123</span></p>
        <button onClick={handleAdminLogin} className="w-full p-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all text-sm">
          Entrar
        </button>
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
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">

      {/* ── Overlay mobile ── */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col
        transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:z-auto
      `}>
        {/* Logo */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 bg-blue-600 rounded-xl flex-shrink-0">
              <Wrench size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-white leading-tight">AutoCenter Pro</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sistema de Gestão</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard"        active={activeTab} onClick={handleTabChange} />
          <NavItem id="services"  icon={Wrench}          label="Serviços"        active={activeTab} onClick={handleTabChange} />
          <NavItem id="quotes"    icon={FileText}        label="Orçamentos"      active={activeTab} onClick={handleTabChange} />
          <NavItem id="clients"   icon={Users}           label="Clientes & Carros" active={activeTab} onClick={handleTabChange} />
          <NavItem id="staff"     icon={Briefcase}       label="Equipa"          active={activeTab} onClick={handleTabChange} />
          <NavItem id="reports"   icon={BarChart3}       label="Relatórios"      active={activeTab} onClick={handleTabChange} />
        </nav>

        {/* ── Sessão / Logout ── */}
        <div className="p-4 m-4 bg-white/5 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-400 uppercase tracking-wider">
              <Lock size={11} /> Administrador
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setPwdError(''); setNewPwd(''); setConfirmPwd(''); setShowChangePwd(true); setSidebarOpen(false); }}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title="Alterar senha"
              >
                <KeyRound size={14} />
              </button>
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-red-400 transition-colors"
                title="Sair"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-10 pb-24 md:pb-10">

          {/* Header */}
          <header className="flex justify-between items-center mb-6 md:mb-10">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm">
                <Menu size={20} />
              </button>
              <div>
                <h2 className="text-blue-600 font-bold text-[9px] uppercase tracking-widest mb-0.5">AutoCenter Pro</h2>
                <h1 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight">{getTabLabel(activeTab)}</h1>
              </div>
            </div>
            {!['dashboard', 'reports'].includes(activeTab) && (
              <button
                onClick={() => { setModalType(getModalType(activeTab)); setFormData({ paymentMethod: 'Dinheiro', staffName: '' }); setShowModal(true); }}
                className="bg-blue-600 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all text-sm"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">{getAddLabel(activeTab)}</span>
              </button>
            )}
          </header>

          {/* ── Dashboard ── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatBox title="Faturamento Hoje"     value={formatBRL(reportData.daily.total)} icon={DollarSign} color="text-emerald-500" />
                <StatBox title="Serviços Hoje"        value={String(reportData.daily.count)}                      icon={Wrench}     color="text-blue-500"   />
                <StatBox title="Profissionais Ativos" value={String(staff.length)}                                icon={UserCircle} color="text-purple-500" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-5 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-black mb-4">Equipa em Campo</h3>
                  <div className="space-y-3">
                    {staff.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-2 rounded-full border border-slate-100 text-slate-400 flex-shrink-0"><UserCircle size={18} /></div>
                          <div className="min-w-0">
                            <button onClick={() => setSelectedStaffName(s.name)} className="font-bold text-slate-800 text-sm truncate text-left hover:text-blue-600 active:text-blue-700 transition-colors block w-full py-0.5">{s.name}</button>
                            <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{s.specialty || 'Mecânico Geral'}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full uppercase flex-shrink-0 ml-2">Ativo</span>
                      </div>
                    ))}
                    {staff.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">Nenhum profissional cadastrado.</p>}
                  </div>
                </div>
                <div className="bg-white p-5 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-black mb-4">Últimas Atribuições</h3>
                  <div className="space-y-3">
                    {services.slice(-4).reverse().map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border-l-4 border-blue-500">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-sm truncate">{s.description}</p>
                          <div className="text-[10px] text-slate-500 font-bold flex items-center mt-0.5">
                            <UserCircle size={11} className="mr-1 flex-shrink-0" />
                            {s.staffName
                              ? <button onClick={() => setSelectedStaffName(s.staffName)} className="truncate hover:text-blue-600 active:text-blue-700 transition-colors text-left">{s.staffName}</button>
                              : <span className="truncate">Pendente</span>
                            }
                          </div>
                        </div>
                        <span className="font-black text-slate-400 text-xs flex-shrink-0 ml-2">{s.date}</span>
                      </div>
                    ))}
                    {services.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">Nenhum serviço registado.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Relatórios ── */}
          {activeTab === 'reports' && (() => {
            const todayStr = new Date().toISOString().split('T')[0];
            const mesAtual = todayStr.substring(0, 7);
            const servicosFiltrados = reportPeriod === 'mes'
              ? services.filter(s => s.date?.substring(0, 7) === mesAtual)
              : services;

            // Agrupar serviços por mecânico
            const porMecanico: Record<string, Service[]> = {};
            servicosFiltrados.forEach(s => {
              const nome = s.staffName || 'Sem Mecânico';
              if (!porMecanico[nome]) porMecanico[nome] = [];
              porMecanico[nome].push(s);
            });

            return (
              <div className="space-y-6">
                {/* Totais */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatBox title={reportPeriod === 'mes' ? 'Faturamento do Mês' : 'Faturamento Total'} value={formatBRL(servicosFiltrados.reduce((a, s) => a + (s.value ?? 0), 0))} icon={DollarSign} color="text-emerald-500" />
                  <StatBox title={reportPeriod === 'mes' ? 'Serviços no Mês' : 'Total de Serviços'} value={String(servicosFiltrados.length)} icon={Wrench} color="text-blue-500" />
                  <StatBox title="Mecânicos Ativos" value={String(Object.keys(porMecanico).length)} icon={UserCircle} color="text-purple-500" />
                </div>

                {/* Filtro de período */}
                <div className="flex items-center gap-2">
                  {(['mes', 'tudo'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setReportPeriod(p)}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${reportPeriod === p ? 'bg-blue-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-300'}`}
                    >
                      {p === 'mes' ? '📅 Este Mês' : '📂 Todo o Período'}
                    </button>
                  ))}
                </div>

                {/* Histórico por mecânico (acordeão) */}
                <div className="space-y-3">
                  <h3 className="text-base font-black flex items-center gap-2 text-slate-800">
                    <Briefcase size={18} className="text-blue-500" /> Histórico por Mecânico
                  </h3>
                  {Object.keys(porMecanico).length === 0 && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
                      Nenhum serviço encontrado no período.
                    </div>
                  )}
                  {Object.entries(porMecanico)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([nome, svcs]) => {
                      const totalMec = svcs.reduce((a, s) => a + (s.value ?? 0), 0);
                      const isOpen = expandedStaff === nome;
                      return (
                        <div key={nome} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                          {/* Cabeçalho do mecânico */}
                          <button
                            onClick={() => setExpandedStaff(isOpen ? null : nome)}
                            className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 transition-colors text-left"
                          >

                            <div className="flex items-center gap-3">
                              <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl flex-shrink-0">
                                <UserCircle size={20} />
                              </div>
                              <div>
                                <p className="font-black text-slate-800 text-sm">{nome}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {svcs.length} serviço{svcs.length !== 1 ? 's' : ''} · {formatBRL(totalMec)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="hidden sm:block font-black text-emerald-600 text-sm">{formatBRL(totalMec)}</span>
                              <span className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                            </div>
                          </button>

                          {/* Lista de serviços do mecânico */}
                          {isOpen && (
                            <div className="border-t border-slate-100">
                              {/* Header desktop */}
                              <div className="hidden md:grid grid-cols-5 gap-3 px-5 py-2 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <span className="col-span-2">Serviço · Cliente</span>
                                <span>Placa</span>
                                <span>Data</span>
                                <span className="text-right">Valor · Status</span>
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
                                          {s.clientName && <p className="text-xs text-slate-500 truncate">👤 {s.clientName}{s.plate ? ` · ${s.plate}` : ''}</p>}
                                        </div>
                                        <StatusBadge status={s.status} paymentMethod={s.paymentMethod} />
                                      </div>
                                      <div className="flex items-center justify-between mt-1.5">
                                        <span className="text-[10px] text-slate-400 font-bold">📅 {s.date || '—'}</span>
                                        <span className="font-black text-blue-600 text-sm">{formatBRL(s.value)}</span>
                                      </div>
                                    </div>
                                    {/* Desktop */}
                                    <div className="hidden md:grid grid-cols-5 gap-3 items-center">
                                      <div className="col-span-2 min-w-0">
                                        <p className="font-bold text-slate-800 text-sm truncate">{s.description}</p>
                                        {s.clientName && <p className="text-xs text-slate-400 truncate">{s.clientName}</p>}
                                      </div>
                                      <span className="text-xs font-bold text-slate-500">{s.plate || '—'}</span>
                                      <span className="text-xs font-bold text-slate-500">{s.date || '—'}</span>
                                      <div className="flex items-center justify-end gap-2">
                                        <span className="font-black text-blue-600 text-sm">{formatBRL(s.value)}</span>
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

                {/* ── Tabela detalhada por mecânico ── */}
                <div className="space-y-3">
                  <h3 className="text-base font-black flex items-center gap-2 text-slate-800">
                    <FileText size={18} className="text-emerald-500" /> Tabela Detalhada por Mecânico
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
                        className="p-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-500">Até</label>
                      <input
                        type="date"
                        value={reportDateTo}
                        onChange={e => setReportDateTo(e.target.value)}
                        className="p-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400"
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

                  {/* Tabela agrupada por mecânico */}
                  {(() => {
                    const filteredByDate = servicosFiltrados.filter(s => {
                      if (reportDateFrom && (s.date || '') < reportDateFrom) return false;
                      if (reportDateTo && (s.date || '') > reportDateTo) return false;
                      return true;
                    });
                    const grouped: Record<string, Service[]> = {};
                    filteredByDate.forEach(s => {
                      const n = s.staffName || 'Sem Mecânico';
                      if (!grouped[n]) grouped[n] = [];
                      grouped[n].push(s);
                    });
                    if (filteredByDate.length === 0) return (
                      <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
                        Nenhum serviço encontrado para o período selecionado.
                      </div>
                    );
                    return Object.entries(grouped)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([nome, svcs]) => {
                        const totalMec = svcs.reduce((a, s) => a + (s.value ?? 0), 0);
                        const svcsSorted = [...svcs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                        return (
                          <div key={nome} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            {/* Nome do mecânico */}
                            <div className="flex items-center justify-between px-5 py-3 bg-slate-800">
                              <div className="flex items-center gap-2">
                                <UserCircle size={16} className="text-blue-300" />
                                <span className="font-black text-white text-sm">{nome}</span>
                                <span className="text-slate-400 text-xs">— {svcs.length} serviço{svcs.length !== 1 ? 's' : ''}</span>
                              </div>
                              <span className="font-black text-emerald-400 text-sm">{formatBRL(totalMec)}</span>
                            </div>
                            {/* Header da tabela */}
                            <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-2 bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              <span className="col-span-1">Data</span>
                              <span className="col-span-4">Serviço / Descrição</span>
                              <span className="col-span-3">Cliente</span>
                              <span className="col-span-2">Placa</span>
                              <span className="col-span-1 text-right">Valor</span>
                              <span className="col-span-1 text-right">Status</span>
                            </div>
                            {/* Linhas */}
                            {svcsSorted.map(s => (
                              <div key={s.id} className="px-4 md:px-5 py-3 border-b border-slate-50 last:border-0 hover:bg-blue-50/30 transition-colors">
                                {/* Mobile */}
                                <div className="md:hidden space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">📅 {s.date || '—'}</span>
                                    <StatusBadge status={s.status} paymentMethod={s.paymentMethod} />
                                  </div>
                                  <p className="font-bold text-slate-800 text-sm">{s.description}</p>
                                  <p className="text-xs text-slate-500">👤 {s.clientName || '—'}{s.plate ? ` · ${s.plate}` : ''}</p>
                                  <p className="font-black text-blue-600 text-sm">{formatBRL(s.value)}</p>
                                </div>
                                {/* Desktop */}
                                <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                                  <span className="col-span-1 text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg text-center">{s.date || '—'}</span>
                                  <div className="col-span-4 min-w-0">
                                    <p className="font-bold text-slate-800 text-sm truncate">{s.description}</p>
                                  </div>
                                  <span className="col-span-3 text-xs text-slate-500 truncate">{s.clientName || '—'}</span>
                                  <span className="col-span-2 text-xs font-bold text-slate-500">{s.plate || '—'}</span>
                                  <span className="col-span-1 text-right font-black text-blue-600 text-sm">{formatBRL(s.value)}</span>
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

          {/* ── Orçamentos ── */}
          {activeTab === 'quotes' && (
            <div className="space-y-4">
              {/* Mobile search */}
              <div className="md:hidden bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center p-3">
                <Search className="text-slate-300 mr-2 flex-shrink-0" size={18} />
                <input
                  placeholder="Procurar orçamentos..."
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
                        <p className="text-xs text-slate-500 mt-0.5">{q.vehicleModel || '—'} {q.vehiclePlate ? `· ${q.vehiclePlate}` : ''}</p>
                      </div>
                      <QuoteStatusBadge status={q.status} />
                    </div>
                    <p className="text-lg font-black text-blue-600 mb-3">{formatBRL(q.total)}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => printQuote(q)} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-bold py-2 rounded-xl hover:bg-slate-200 transition-colors">
                        <Printer size={13} /> PDF
                      </button>
                      <button onClick={() => shareWhatsApp(q)} className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 text-green-700 text-xs font-bold py-2 rounded-xl hover:bg-green-100 transition-colors">
                        <WhatsAppIcon size={13} /> WhatsApp
                      </button>
                      <button onClick={() => openEditQuote(q)} className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-bold py-2 rounded-xl hover:bg-blue-100 transition-colors">
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
                {quotes.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">Nenhum orçamento ainda. Crie o primeiro!</p>}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b flex items-center bg-slate-50/50">
                  <Search className="text-slate-300 mr-2 flex-shrink-0" size={18} />
                  <input placeholder="Procurar orçamentos..." className="bg-transparent outline-none w-full font-medium text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                    <tr>
                      <th className="p-5">Cliente</th>
                      <th className="p-5">Veículo / Placa</th>
                      <th className="p-5">Total</th>
                      <th className="p-5">Status</th>
                      <th className="p-5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {quotes.filter(q => JSON.stringify(q).toLowerCase().includes(searchTerm.toLowerCase())).map(q => (
                      <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-5 font-bold text-slate-800 text-sm">{q.clientName}</td>
                        <td className="p-5 text-sm text-slate-500">{q.vehicleModel || '—'}{q.vehiclePlate ? ` · ${q.vehiclePlate}` : ''}</td>
                        <td className="p-5 font-black text-blue-600 text-sm">{formatBRL(q.total)}</td>
                        <td className="p-5"><QuoteStatusBadge status={q.status} /></td>
                        <td className="p-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => printQuote(q)} title="Gerar PDF" className="flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-slate-200 transition-colors">
                              <Printer size={14} /> PDF
                            </button>
                            <button onClick={() => shareWhatsApp(q)} title="Enviar via WhatsApp" className="flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-green-100 transition-colors">
                              <WhatsAppIcon size={14} /> WhatsApp
                            </button>
                            <button onClick={() => openEditQuote(q)} title="Editar" className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors">
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
                      <tr><td colSpan={5} className="p-10 text-center text-slate-400 text-sm">Nenhum orçamento registado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tabela / Cards ── */}
          {(['services', 'staff', 'vehicles', 'customers', 'clients'] as TabName[]).includes(activeTab) && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Barra de pesquisa */}
              <div className="p-3 md:p-4 border-b flex items-center bg-slate-50/50">
                <Search className="text-slate-300 mr-2 flex-shrink-0" size={18} />
                <input
                  placeholder={activeTab === 'services' ? 'Buscar por cliente, placa ou serviço...' : activeTab === 'clients' ? 'Buscar por nome, placa ou veículo...' : 'Procurar na base...'}
                  className="bg-transparent outline-none w-full font-medium text-sm"
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              {/* Filtros rápidos de status (apenas serviços) */}
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
                              {svc.plate && <span>{svc.plate} ·</span>}
                              {svc.staffName
                                ? <button onClick={() => setSelectedStaffName(svc.staffName)} className="hover:text-blue-600 active:text-blue-700 transition-colors font-bold truncate text-left">{svc.staffName}</button>
                                : <span>Sem mecânico</span>
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
                      <th className="p-6 text-right">Ação</th>
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
                                      {svc.plate && <span>{svc.plate} ·</span>}
                                      {svc.staffName
                                        ? <button onClick={() => setSelectedStaffName(svc.staffName)} className="hover:text-blue-600 active:text-blue-700 transition-colors font-bold text-left">{svc.staffName}</button>
                                        : <span>Sem mecânico</span>
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

        {/* ── Bottom Nav (mobile) ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-white/5 flex z-30">
          <BottomNavItem id="dashboard" icon={LayoutDashboard} label="Home"       active={activeTab} onClick={handleTabChange} />
          <BottomNavItem id="services"  icon={Wrench}          label="Serviços"   active={activeTab} onClick={handleTabChange} />
          <BottomNavItem id="quotes"    icon={FileText}        label="Orçamentos" active={activeTab} onClick={handleTabChange} />
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

      {/* ══════════════════════════════════════════
          MODAL ALTERAR SENHA
      ══════════════════════════════════════════ */}
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
                  placeholder="Nova senha (mín. 4 caracteres)"
                  value={newPwd}
                  onChange={e => { setNewPwd(e.target.value); setPwdError(''); }}
                  className="w-full p-4 pr-12 bg-slate-50 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-blue-400"
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
                className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-blue-400"
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

      {/* ── Modal de registo (OS / Veículo / etc) ── */}
      {showModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-50"
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditingQuoteId(null); } }}
        >
          <div className="bg-white rounded-t-3xl md:rounded-[32px] p-6 md:p-10 w-full md:max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6 md:hidden" />
            <h2 className="text-xl md:text-2xl font-black mb-6">
              {modalType === 'staff' ? 'Novo Profissional' : modalType === 'vehicle' ? 'Novo Veículo' : modalType === 'customer' ? 'Novo Cliente' : modalType === 'client' ? 'Novo Cadastro' : modalType === 'quote' ? (editingQuoteId ? 'Editar Orçamento' : 'Novo Orçamento') : 'Novo Serviço'}
            </h2>
            <div className="space-y-4">
              {modalType === 'staff' && (
                <>
                  <input placeholder="Nome do Mecânico" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, name: e.target.value}))} />
                  <input placeholder="Especialidade (Ex: Suspensão, Motor)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, specialty: e.target.value}))} />
                </>
              )}
              {modalType === 'vehicle' && (
                <>
                  <input placeholder="Modelo do Veículo (Ex: Civic 2022)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, model: e.target.value}))} />
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
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 pt-1">Dados do Veículo</p>
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
                        display: cr.phone ? `${cr.name}  ·  ${cr.phone}` : cr.name,
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
                          display: cr.vehicleModel ? `${cr.vehiclePlate}  ·  ${cr.vehicleModel}` : cr.vehiclePlate!,
                          value: cr.vehiclePlate!,
                        }))}
                    />
                  </div>
                  <input placeholder="Descrição do Serviço" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, description: e.target.value}))} />
                  <input type="number" placeholder="Valor estimado (BRL)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, value: e.target.value}))} />
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Profissional Responsável</p>
                    <select className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 text-sm" onChange={e => setFormData(f => ({...f, staffName: e.target.value}))}>
                      <option value="">Selecione o mecânico...</option>
                      {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  {/* Info: pagamento é definido na entrega */}
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl p-3">
                    <Clock size={14} className="text-amber-500 flex-shrink-0" />
                    <p className="text-[11px] text-amber-700 font-bold">A forma de pagamento será definida na entrega do serviço.</p>
                  </div>
                </>
              )}
              {modalType === 'quote' && (
                <>
                  {/* Cliente + Veículo */}
                  <AutocompleteInput
                    placeholder="Nome do Cliente *"
                    value={quoteClient}
                    onChange={setQuoteClient}
                    suggestions={clientRecords.map(cr => ({
                      display: cr.phone ? `${cr.name}  ·  ${cr.phone}` : cr.name,
                      value: cr.name,
                    }))}
                  />
                  <input placeholder="Endereço" value={quoteAddress} onChange={e => setQuoteAddress(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Telefone" value={quotePhone} onChange={e => setQuotePhone(e.target.value)} className="p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                    <input placeholder="E-mail" value={quoteEmail} onChange={e => setQuoteEmail(e.target.value)} className="p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <AutocompleteInput
                      placeholder="Modelo do Veículo"
                      value={quoteVehicle}
                      onChange={val => {
                        setQuoteVehicle(val);
                        const found = clientRecords.find(cr => cr.vehicleModel === val);
                        if (found?.vehiclePlate) setQuotePlate(found.vehiclePlate);
                      }}
                      suggestions={clientRecords.filter(cr => cr.vehicleModel).map(cr => ({
                        display: cr.vehiclePlate ? `${cr.vehicleModel}  ·  ${cr.vehiclePlate}` : cr.vehicleModel!,
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
                          display: cr.vehicleModel ? `${cr.vehiclePlate}  ·  ${cr.vehicleModel}` : cr.vehiclePlate!,
                          value: cr.vehiclePlate!,
                        }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Km" value={quoteKm} onChange={e => setQuoteKm(e.target.value)} className="p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                    <input placeholder="Ano/Modelo" value={quoteYearModel} onChange={e => setQuoteYearModel(e.target.value)} className="p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                  </div>

                  {/* Itens do orçamento */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Serviços / Itens *</p>
                      <button
                        onClick={() => setQuoteItems(prev => [...prev, { description: '', qty: 1, unitValue: 0 }])}
                        className="flex items-center gap-1 text-blue-600 text-xs font-bold hover:text-blue-700"
                      >
                        <PlusCircle size={14} /> Adicionar item
                      </button>
                    </div>
                    <div className="space-y-2">
                      {quoteItems.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            placeholder="Descrição do serviço"
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
                  <div className="flex justify-between items-center bg-blue-50 rounded-2xl p-4 border border-blue-100">
                    <span className="text-sm font-black text-slate-600">Total do Orçamento</span>
                    <span className="text-lg font-black text-blue-600">
                      {formatBRL(Math.max(0, quoteItems.reduce((acc, i) => acc + i.qty * i.unitValue, 0) - (parseFloat(quoteDiscount) || 0)))}
                    </span>
                  </div>

                  {/* Observações */}
                  <textarea
                    placeholder="Observações"
                    value={quoteObservations}
                    onChange={e => setQuoteObservations(e.target.value)}
                    rows={2}
                    className="w-full p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm resize-none"
                  />

                  {/* Condições de pagamento + validade */}
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Condições de Pagamento" value={quotePayment} onChange={e => setQuotePayment(e.target.value)} className="p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                    <input placeholder="Válido por (dias)" value={quoteValidDays} onChange={e => setQuoteValidDays(e.target.value)} className="p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                  </div>
                </>
              )}
              <div className="flex gap-3 pt-4 border-t">
                <button onClick={() => { setShowModal(false); setEditingQuoteId(null); }} className="flex-1 p-4 font-bold text-slate-400 hover:text-slate-600 transition-colors text-sm">Cancelar</button>
                <button
                  onClick={modalType === 'quote' ? handleSaveQuote : handleSave}
                  className="flex-1 p-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all text-sm"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODAL HISTÓRICO DO MECÂNICO
      ══════════════════════════════════════════ */}
      {selectedStaffName && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-[60]"
          onClick={e => { if (e.target === e.currentTarget) setSelectedStaffName(null); }}
        >
          <div className="bg-white rounded-t-3xl md:rounded-[32px] p-6 md:p-8 w-full md:max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5 md:hidden" />

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl">
                  <UserCircle size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">{selectedStaffName}</h2>
                  <p className="text-xs text-slate-400 font-bold">Histórico de Serviços</p>
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
                    <div className="bg-blue-50 rounded-2xl p-4 text-center">
                      <p className="text-2xl font-black text-blue-600">{staffSvcs.length}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Serviços</p>
                    </div>
                    <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                      <p className="text-lg font-black text-emerald-600">{formatBRL(totalVal)}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Faturado</p>
                    </div>
                  </div>
                  {staffSvcs.length === 0 ? (
                    <p className="text-center text-slate-400 py-8 text-sm">Nenhum serviço registrado para este mecânico.</p>
                  ) : (
                    <div className="space-y-2">
                      {staffSvcs.map(s => (
                        <div key={s.id} className="bg-slate-50 rounded-2xl p-4 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 text-sm truncate">{s.description}</p>
                            {s.clientName && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">👤 {s.clientName}{s.plate ? ` · ${s.plate}` : ''}</p>
                            )}
                            <p className="text-[10px] text-slate-400 font-bold mt-1">📅 {s.date || '—'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <span className="font-black text-blue-600 text-sm">{formatBRL(s.value)}</span>
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

      {/* ══════════════════════════════════════════
          MODAL ENTREGA DO SERVIÇO
      ══════════════════════════════════════════ */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-[60]">
          <div className="bg-white rounded-t-3xl md:rounded-[32px] p-6 md:p-10 w-full md:max-w-sm shadow-2xl">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6 md:hidden" />

            <div className="flex flex-col items-center mb-8">
              <div className="bg-emerald-500 p-4 rounded-2xl mb-4 shadow-lg shadow-emerald-200">
                <CheckCircle size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-slate-800">Entregar Serviço</h2>
              <p className="text-sm text-slate-400 mt-1 text-center">Selecione a forma de pagamento para finalizar</p>
            </div>

            <div className="mb-6">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Forma de Pagamento</p>
              <div className="grid grid-cols-3 gap-2">
                {['Dinheiro', 'Pix', 'Cartão'].map(method => (
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
    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
      active === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`}
  >
    <Icon size={18} className="flex-shrink-0" />
    <span className="text-xs font-bold">{label}</span>
  </button>
);

const BottomNavItem: React.FC<NavItemProps> = ({ id, icon: Icon, label, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${
      active === id ? 'text-blue-400' : 'text-slate-500 hover:text-white'
    }`}
  >
    <Icon size={20} />
    <span className="text-[9px] mt-1 font-bold truncate w-full text-center px-1">{label}</span>
  </button>
);

interface StatBoxProps { title: string; value: string; icon: React.ElementType<any>; color: string; }
const StatBox: React.FC<StatBoxProps> = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-xl md:text-2xl font-black">{value}</p>
    </div>
    <div className={`p-3 rounded-xl bg-slate-50 ${color} flex-shrink-0`}><Icon size={20} /></div>
  </div>
);

interface StatusBadgeProps { status: string; paymentMethod?: string; }
const StatusBadge: React.FC<StatusBadgeProps> = ({ status, paymentMethod }) => {
  if (status === 'Entregue') {
    return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full">
        <CheckCircle size={10} />
        Entregue{paymentMethod ? ` · ${paymentMethod}` : ''}
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
        className={`w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-blue-300 ${className}`}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-[70] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
          {filtered.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => { onChange(s.value); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-slate-50 last:border-0 truncate"
            >
              {s.display}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// WhatsApp SVG icon (lucide não possui)
const WhatsAppIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);


export default App;
