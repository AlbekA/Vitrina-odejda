import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Lock, 
  ArrowRight, 
  Upload, 
  Trash2, 
  RefreshCw, 
  LogOut, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  Image as ImageIcon,
  ChevronDown,
  X,
  FileCode,
  Copy,
  Check,
  Download
} from 'lucide-react';

const SUPABASE_URL = "https://vhpsergcgxohylyaspbf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZocHNlcmdjZ3hvaHlseWFzcGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MzkzNDIsImV4cCI6MjEwOTIxNTM0Mn0.1ryNsbK3lABDCHxStHL37_M3L7-Y6vnENjdj27CGP5Q";
const STORAGE_BUCKET = "product-images";
const TABLE_NAME = "products";
const ADMIN_PASSWORD = "admin1234";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Product {
  id: number;
  name?: string;
  title?: string;
  category?: string;
  price?: number;
  size?: string;
  volume?: string;
  image_url?: string;
  photo_url?: string;
  image?: string;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('admin_authenticated') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('Все');

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Унисекс');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Delete modal state
  const [productToDelete, setProductToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Code modal state (for convenient copying of admin.html)
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [htmlCode, setHtmlCode] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadProducts();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetch('/admin.html')
      .then(res => res.text())
      .then(text => setHtmlCode(text))
      .catch(() => {});
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_authenticated', 'true');
      setIsAuthenticated(true);
      setAuthError(false);
      setPasswordInput('');
    } else {
      setAuthError(true);
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_authenticated');
    setIsAuthenticated(false);
    setPasswordInput('');
    setAuthError(false);
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('id', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }
      setProducts(data || []);
    } catch (err: any) {
      showNotification(`Не удалось загрузить товары: ${err.message}`, 'error');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('Пожалуйста, выберите файл изображения (JPG, PNG, WEBP)', 'error');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      showNotification('Пожалуйста, выберите фотографию товара', 'error');
      return;
    }

    const priceNum = parseFloat(price);
    if (!name.trim() || isNaN(priceNum) || !size.trim()) {
      showNotification('Заполните все обязательные поля корректно', 'error');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('1/2: Загружаем изображение в Storage...');

    try {
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const cleanExt = fileExt.replace(/[^a-z0-9]/g, '');
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${cleanExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Ошибка загрузки фото: ${uploadError.message}`);
      }

      // Get public URL
      const { data: publicData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(fileName);

      const publicUrl = publicData?.publicUrl || '';

      setStatusMessage('2/2: Сохраняем товар в базу данных...');

      const payload = {
        name: name.trim(),
        category,
        price: priceNum,
        size: size.trim(),
        image_url: publicUrl
      };

      let { error: insertError } = await supabase
        .from(TABLE_NAME)
        .insert([payload]);

      // Fallback if column is named "volume" instead of "size"
      if (insertError && insertError.message.includes('column "size"')) {
        const fallback = {
          name: name.trim(),
          category,
          price: priceNum,
          volume: size.trim(),
          image_url: publicUrl
        };
        const retry = await supabase.from(TABLE_NAME).insert([fallback]);
        insertError = retry.error;
      }

      if (insertError) {
        throw new Error(`Ошибка записи в таблицу: ${insertError.message}`);
      }

      showNotification('Товар успешно добавлен!', 'success');
      setName('');
      setPrice('');
      setSize('');
      clearFile();
      await loadProducts();

    } catch (err: any) {
      showNotification(err.message || 'Ошибка при публикации товара', 'error');
    } finally {
      setIsSubmitting(false);
      setStatusMessage('');
    }
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', productToDelete);

      if (error) {
        throw new Error(error.message);
      }

      showNotification('Товар успешно удален', 'success');
      setProductToDelete(null);
      await loadProducts();
    } catch (err: any) {
      showNotification(`Не удалось удалить: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyCode = () => {
    if (!htmlCode) return;
    navigator.clipboard.writeText(htmlCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([htmlCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'admin.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredProducts = categoryFilter === 'Все'
    ? products
    : products.filter(p => (p.category || '').toLowerCase() === categoryFilter.toLowerCase());

  // ==========================================
  // 1. ЕСЛИ НЕ АВТОРИЗОВАН — ТОЛЬКО ОКНО ВХОДА
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-100 font-sans selection:bg-emerald-100 selection:text-emerald-900 relative">
        {/* Кнопка просмотра/скачивания файла admin.html (не мешает интерфейсу) */}
        <button
          onClick={() => setShowCodeModal(true)}
          className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 text-xs font-medium rounded-xl border border-slate-200 shadow-xs transition"
          title="Посмотреть чистый код файла admin.html"
        >
          <FileCode className="w-3.5 h-3.5 text-emerald-600" />
          <span>Код admin.html</span>
        </button>

        {/* Окно авторизации */}
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-200/80 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 mx-auto mb-4 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-xs">
            <Lock className="w-7 h-7 stroke-[2]" />
          </div>

          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Вход в админ-панель</h1>
          <p className="text-xs text-slate-500 mt-1.5 mb-6">Введите пароль для управления онлайн-витриной</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
                className="w-full px-4 py-3 text-center text-lg tracking-widest bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            {authError && (
              <div className="text-xs text-rose-600 font-medium bg-rose-50 py-2.5 px-3 rounded-xl border border-rose-200">
                Неверный пароль. Попробуйте еще раз.
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl shadow-md transition active:scale-[0.98] text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Войти</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Модальное окно кода admin.html */}
        {showCodeModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-sm text-slate-800">Файл admin.html (автономный код)</h3>
                </div>
                <button 
                  onClick={() => setShowCodeModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-slate-950 text-slate-200 font-mono text-xs overflow-auto flex-1">
                <pre>{htmlCode || 'Загрузка кода...'}</pre>
              </div>

              <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-2xl">
                <button
                  onClick={handleCopyCode}
                  className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 transition flex items-center gap-1.5"
                >
                  {codeCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{codeCopied ? 'Скопировано!' : 'Копировать'}</span>
                </button>
                <button
                  onClick={handleDownloadHtml}
                  className="px-3.5 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Скачать admin.html</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // 2. ОСНОВНАЯ АДМИН-ПАНЕЛЬ (БЕЗ ФУТЕРА)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900 pb-12">
      {/* Шапка */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-tight">Админ-панель витрины</h2>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Supabase подключен</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadProducts}
              title="Обновить список"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <RefreshCw className={`w-5 h-5 ${loadingProducts ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        
        {/* ФОРМА ДОБАВЛЕНИЯ ТОВАРА */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
          <div className="px-5 py-4 sm:px-6 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-sm font-bold">
                <Plus className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-800">Добавить новый товар</h3>
            </div>
            <span className="text-xs text-slate-400">онлайн-витрина</span>
          </div>

          <form onSubmit={handleProductSubmit} className="p-5 sm:p-6 space-y-5">
            {/* Поле загрузки фото */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Фотография товара <span className="text-rose-500">*</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50/70 hover:bg-emerald-50/30 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center group"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 group-hover:bg-white text-slate-400 group-hover:text-emerald-600 flex items-center justify-center shadow-xs transition mb-2">
                    <ImageIcon className="w-6 h-6 stroke-[1.75]" />
                  </div>
                  <div className="text-sm font-medium text-slate-700">
                    <span className="text-emerald-600 font-semibold underline underline-offset-2">Выберите фото</span> или перетащите сюда
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Форматы: JPG, PNG, WEBP. Корзина: <span className="font-mono text-slate-500">product-images</span></p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/50 flex flex-col sm:flex-row items-center gap-4">
                  <img
                    src={previewUrl || ''}
                    alt="Предпросмотр"
                    className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-xl border border-slate-200 shadow-xs"
                  />
                  <div className="flex-1 min-w-0 text-center sm:text-left">
                    <p className="text-sm font-semibold text-slate-800 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    <div className="mt-2.5 flex justify-center sm:justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                      >
                        Заменить фото
                      </button>
                      <button
                        type="button"
                        onClick={clearFile}
                        className="px-2.5 py-1 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Название товара */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Название товара <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Парфюм Velvet Amber или Футболка Oversize"
                required
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            {/* Сетка: Категория, Цена, Объем/Размер */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Категория <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    className="w-full appearance-none px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition pr-10 cursor-pointer"
                  >
                    <option value="Мужские">Мужские</option>
                    <option value="Женские">Женские</option>
                    <option value="Унисекс">Унисекс</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Цена <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="2500"
                    min="0"
                    step="any"
                    required
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition pl-8"
                  />
                  <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400">₽</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Объем / размер <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="Например: 50 мл или M"
                  required
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Кнопка отправки */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition active:scale-[0.99] text-sm sm:text-base flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Upload className="w-5 h-5" />
                <span>{isSubmitting ? 'Публикация...' : 'Опубликовать товар'}</span>
              </button>
              {statusMessage && (
                <p className="text-xs text-center text-slate-500 mt-2">{statusMessage}</p>
              )}
            </div>
          </form>
        </section>

        {/* СПИСОК ТОВАРОВ */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-800">Список товаров</h3>
              <span className="bg-slate-200 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                {filteredProducts.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
              {['Все', 'Мужские', 'Женские', 'Унисекс'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {loadingProducts ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs text-slate-500">Загрузка товаров из базы...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center max-w-md mx-auto">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">Товары еще не добавлены</h4>
              <p className="text-xs text-slate-400 mt-1">Используйте форму выше, чтобы добавить первый товар.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((p) => {
                const title = p.name || p.title || 'Без названия';
                const cat = p.category || 'Унисекс';
                const formattedPrice = p.price ? Number(p.price).toLocaleString('ru-RU') : '0';
                const sizeOrVolume = p.size || p.volume || '';
                const img = p.image_url || p.photo_url || p.image || '';

                const badgeBg = cat === 'Мужские' 
                  ? 'bg-sky-500/90 text-white' 
                  : cat === 'Женские' 
                  ? 'bg-pink-500/90 text-white' 
                  : 'bg-amber-500/90 text-white';

                return (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col group"
                  >
                    <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                      {img ? (
                        <img
                          src={img}
                          alt={title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <ImageIcon className="w-10 h-10 stroke-[1.5]" />
                        </div>
                      )}

                      <span className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold tracking-wide backdrop-blur-md shadow-xs ${badgeBg}`}>
                        {cat}
                      </span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 line-clamp-1 group-hover:text-emerald-700 transition" title={title}>
                          {title}
                        </h4>
                        {sizeOrVolume && (
                          <div className="mt-1">
                            <span className="inline-flex items-center text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded">
                              {sizeOrVolume}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-slate-400 block font-normal">Цена</span>
                          <span className="text-base font-extrabold text-slate-900">{formattedPrice} ₽</span>
                        </div>

                        <button
                          onClick={() => setProductToDelete(p.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 rounded-lg transition active:scale-95 cursor-pointer"
                          title="Удалить товар"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Удалить</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* МОДАЛКА УДАЛЕНИЯ */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center border border-slate-100 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto mb-3 flex items-center justify-center">
              <Trash2 className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Удалить этот товар?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">Товар будет удален из базы данных Supabase.</p>

            <div className="flex gap-2">
              <button
                onClick={() => setProductToDelete(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Отмена
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Удаление...' : 'Да, удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST УВЕДОМЛЕНИЯ */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full px-4 sm:px-0">
          <div className={`px-4 py-3 rounded-xl shadow-lg flex items-center justify-between gap-3 text-sm font-medium animate-in slide-in-from-bottom-2 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}>
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
            <button onClick={() => setToast(null)} className="text-white/80 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
