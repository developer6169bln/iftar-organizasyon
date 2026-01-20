'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const categoryMap: Record<string, { name: string; icon: string; color: string; dbCategory: string }> = {
  protocol: { name: 'Protokol', icon: '📋', color: 'bg-blue-500', dbCategory: 'PROTOCOL' },
  guest_list: { name: 'Davet Listesi', icon: '👥', color: 'bg-green-500', dbCategory: 'GUEST_LIST' },
  guest_reception: { name: 'Misafir Karşılama', icon: '🚪', color: 'bg-purple-500', dbCategory: 'GUEST_RECEPTION' },
  security: { name: 'Güvenlik', icon: '🔒', color: 'bg-red-500', dbCategory: 'SECURITY' },
  hotel_coordination: { name: 'Otel Koordinasyon', icon: '🏨', color: 'bg-yellow-500', dbCategory: 'HOTEL_COORDINATION' },
  sahur_coordination: { name: 'Sahur Koordinasyon', icon: '🌙', color: 'bg-indigo-500', dbCategory: 'SAHUR_COORDINATION' },
  music_team: { name: 'Müzik Ekibi', icon: '🎵', color: 'bg-pink-500', dbCategory: 'MUSIC_TEAM' },
  speaker: { name: 'Konuşmacı', icon: '🎤', color: 'bg-teal-500', dbCategory: 'SPEAKER' },
  headquarters: { name: 'Genel Merkez Koordinasyon', icon: '🏢', color: 'bg-gray-500', dbCategory: 'HEADQUARTERS' },
  program_flow: { name: 'Program Akışı', icon: '⏱️', color: 'bg-orange-500', dbCategory: 'PROGRAM_FLOW' },
}

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const category = params.category as string
  const categoryInfo = categoryMap[category]
  const [checklistItems, setChecklistItems] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [eventId, setEventId] = useState<string | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showChecklistModal, setShowChecklistModal] = useState(false)
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [editingChecklist, setEditingChecklist] = useState<string | null>(null)
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    dueDate: '',
    status: 'PENDING',
  })
  const [checklistForm, setChecklistForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    status: 'NOT_STARTED',
  })
  const [vipGuests, setVipGuests] = useState<any[]>([])
  const [receptionGuests, setReceptionGuests] = useState<any[]>([])
  const [editingGuest, setEditingGuest] = useState<string | null>(null)
  const [guestEditData, setGuestEditData] = useState<any>({})
  const [editingReceptionGuest, setEditingReceptionGuest] = useState<string | null>(null)
  const [receptionGuestEditData, setReceptionGuestEditData] = useState<any>({})

  useEffect(() => {
    if (!categoryInfo) {
      router.push('/dashboard')
      return
    }

    loadEventAndData()
  }, [category])

  const loadEventAndData = async () => {
    try {
      // Önce Event'i al veya oluştur
      const eventResponse = await fetch('/api/events')
      if (eventResponse.ok) {
        const event = await eventResponse.json()
        setEventId(event.id)
        
        // Tasks ve Checklist items yükle
        await loadData(event.id)
      }
    } catch (error) {
      console.error('Event yükleme hatası:', error)
      setLoading(false)
    }
  }

  const loadData = async (eventId: string) => {
    try {
      // Tasks yükle
      const tasksResponse = await fetch(`/api/tasks?category=${categoryInfo.dbCategory}&eventId=${eventId}`)
      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json()
        setTasks(tasksData)
        
        // Eğer tasks yoksa, seed data yükle
        if (tasksData.length === 0) {
          await loadCategorySeedData(eventId, categoryInfo.dbCategory)
        }
      }

      // Checklist items yükle
      const checklistResponse = await fetch(`/api/checklist?category=${categoryInfo.dbCategory}&eventId=${eventId}`)
      if (checklistResponse.ok) {
        const checklistData = await checklistResponse.json()
        setChecklistItems(checklistData)
      }

      // VIP-Gäste laden (nur für Protokoll)
      if (categoryInfo.dbCategory === 'PROTOCOL') {
        await loadVipGuests(eventId)
      }

      // Empfangs-Gäste laden (nur für Guest Reception)
      if (categoryInfo.dbCategory === 'GUEST_RECEPTION') {
        await loadReceptionGuests(eventId)
      }

      setLoading(false)
    } catch (error) {
      console.error('Veri yükleme hatası:', error)
      setLoading(false)
    }
  }

  const loadCategorySeedData = async (eventId: string, category: string) => {
    try {
      const seedData = getSeedDataForCategory(eventId, category)
      
      // Tasks erstellen
      for (const task of seedData.tasks) {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        })
      }

      // Checklist Items erstellen
      for (const item of seedData.checklist) {
        await fetch('/api/checklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        })
      }

      // Daten neu laden
      await loadData(eventId)
    } catch (error) {
      console.error('Seed data yükleme hatası:', error)
    }
  }

  const getSeedDataForCategory = (eventId: string, category: string) => {
    const seedData: { tasks: any[], checklist: any[] } = { tasks: [], checklist: [] }

    if (category === 'PROTOCOL') {
      seedData.tasks = [
        {
          eventId,
          category: 'PROTOCOL',
          title: 'Protokol sıralamasının belirlenmesi',
          description: 'Kamu yetkilileri, STK başkanları, iş insanları, kanaat önderleri vb. protokol sıralaması',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'PROTOCOL',
          title: 'Protokol masalarının yerleşim planı',
          description: 'Protokol masalarının salon içindeki yerleşim planının hazırlanması',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'PROTOCOL',
          title: 'Protokol giriş–çıkış düzeni',
          description: 'VIP misafirlerin giriş ve çıkış planlaması ve yönlendirmesi',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'PROTOCOL',
          title: 'Özel karşılama ve refakatçi belirlenmesi',
          description: 'VIP misafirler için özel karşılama ekibi ve refakatçi görevlendirmeleri',
          priority: 'MEDIUM',
        },
        {
          eventId,
          category: 'PROTOCOL',
          title: 'Protokol konuşma sırası ve süresi',
          description: 'Protokol konuşmalarının sırası ve her konuşmacı için süre belirlenmesi',
          priority: 'MEDIUM',
        },
      ]

      seedData.checklist = [
        {
          eventId,
          category: 'PROTOCOL',
          title: 'Yazılı protokol listesi hazır',
          description: 'Tüm VIP misafirlerin yazılı protokol listesi hazırlandı',
        },
        {
          eventId,
          category: 'PROTOCOL',
          title: 'Oturma planı onaylandı',
          description: 'Protokol masalarının yerleşim planı onaylandı',
        },
        {
          eventId,
          category: 'PROTOCOL',
          title: 'Refakatçiler atandı ve bilgilendirildi',
          description: 'Tüm refakatçiler görevleri hakkında bilgilendirildi',
        },
        {
          eventId,
          category: 'PROTOCOL',
          title: 'Konuşma sırası belirlendi',
          description: 'Protokol konuşma sırası ve süreleri netleştirildi',
        },
      ]
    } else if (category === 'GUEST_LIST') {
      seedData.tasks = [
        {
          eventId,
          category: 'GUEST_LIST',
          title: 'Ana davetli listesi oluşturma',
          description: 'VIP / Standart / Basın kategorilerinde ana davetli listesi hazırlama',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'GUEST_LIST',
          title: 'Davetiye gönderimi planlama',
          description: 'Dijital ve basılı davetiye gönderim planı',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'GUEST_LIST',
          title: 'Katılım teyidi (RSVP) takibi',
          description: 'Davetlilerden katılım teyidi alma ve takip etme',
          priority: 'MEDIUM',
        },
        {
          eventId,
          category: 'GUEST_LIST',
          title: 'Yedek davetli listesi hazırlama',
          description: 'Olası iptaller için yedek davetli listesi oluşturma',
          priority: 'LOW',
        },
        {
          eventId,
          category: 'GUEST_LIST',
          title: 'Son katılımcı sayısının netleştirilmesi',
          description: 'Etkinlik öncesi kesin katılımcı sayısını belirleme',
          priority: 'HIGH',
        },
      ]

      seedData.checklist = [
        {
          eventId,
          category: 'GUEST_LIST',
          title: 'Ana davetli listesi tamamlandı',
          description: 'VIP, Standart ve Basın kategorilerinde liste hazır',
        },
        {
          eventId,
          category: 'GUEST_LIST',
          title: 'Davetiyeler gönderildi',
          description: 'Tüm davetiyeler (dijital + basılı) gönderildi',
        },
        {
          eventId,
          category: 'GUEST_LIST',
          title: 'RSVP takibi tamamlandı',
          description: 'Tüm katılım teyitleri alındı',
        },
        {
          eventId,
          category: 'GUEST_LIST',
          title: 'Güncel Excel/Sheets listesi hazır',
          description: 'Son durum Excel/Sheets formatında hazırlandı',
        },
      ]
    } else if (category === 'GUEST_RECEPTION') {
      seedData.tasks = [
        {
          eventId,
          category: 'GUEST_RECEPTION',
          title: 'Karşılama masası kurulumu',
          description: 'Giriş alanında karşılama masasının kurulumu ve düzeni',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'GUEST_RECEPTION',
          title: 'Hostes/karşılama ekibi görevlendirme',
          description: 'Karşılama ekibinin belirlenmesi ve görev dağılımı',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'GUEST_RECEPTION',
          title: 'İsim listesi + yaka kartları hazırlama',
          description: 'Misafir isim listesi ve yaka kartlarının hazırlanması',
          priority: 'MEDIUM',
        },
        {
          eventId,
          category: 'GUEST_RECEPTION',
          title: 'Protokol misafirlerine özel yönlendirme',
          description: 'VIP misafirler için özel karşılama ve yönlendirme planı',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'GUEST_RECEPTION',
          title: 'Fotoğraf & basın yönlendirmesi',
          description: 'Fotoğraf çekimi ve basın mensupları için yönlendirme planı',
          priority: 'MEDIUM',
        },
      ]

      seedData.checklist = [
        {
          eventId,
          category: 'GUEST_RECEPTION',
          title: 'Karşılama masası kuruldu',
          description: 'Karşılama masası ve düzeni hazır',
        },
        {
          eventId,
          category: 'GUEST_RECEPTION',
          title: 'Karşılama ekibi görevlendirildi',
          description: 'Tüm ekip üyeleri görevleri hakkında bilgilendirildi',
        },
        {
          eventId,
          category: 'GUEST_RECEPTION',
          title: 'Yaka kartları hazır',
          description: 'Tüm misafirler için yaka kartları hazırlandı',
        },
        {
          eventId,
          category: 'GUEST_RECEPTION',
          title: 'Karşılama senaryosu hazır',
          description: 'Karşılama senaryosu ve ekip listesi tamamlandı',
        },
      ]
    } else if (category === 'SECURITY') {
      seedData.tasks = [
        {
          eventId,
          category: 'SECURITY',
          title: 'Otel güvenliği ile koordinasyon',
          description: 'Otel güvenlik ekibi ile koordinasyon ve işbirliği',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'SECURITY',
          title: 'VIP misafirler için ek önlem',
          description: 'VIP misafirler için ek güvenlik önlemleri planlama',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'SECURITY',
          title: 'Giriş–çıkış kontrol noktaları',
          description: 'Giriş ve çıkış kontrol noktalarının belirlenmesi',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'SECURITY',
          title: 'Olası acil durum planı',
          description: 'Acil durum senaryoları ve müdahale planı',
          priority: 'MEDIUM',
        },
        {
          eventId,
          category: 'SECURITY',
          title: 'Güvenlik sorumlusu atanması',
          description: 'Etkinlik güvenlik sorumlusunun belirlenmesi',
          priority: 'HIGH',
        },
      ]

      seedData.checklist = [
        {
          eventId,
          category: 'SECURITY',
          title: 'Otel güvenliği ile koordinasyon tamamlandı',
          description: 'Otel güvenlik ekibi ile toplantı yapıldı',
        },
        {
          eventId,
          category: 'SECURITY',
          title: 'Güvenlik planı hazır',
          description: 'Detaylı güvenlik planı ve iletişim zinciri oluşturuldu',
        },
        {
          eventId,
          category: 'SECURITY',
          title: 'Kontrol noktaları belirlendi',
          description: 'Giriş-çıkış kontrol noktaları ve görevliler atandı',
        },
        {
          eventId,
          category: 'SECURITY',
          title: 'Acil durum planı hazır',
          description: 'Olası acil durumlar için müdahale planı hazırlandı',
        },
      ]
    } else if (category === 'HOTEL_COORDINATION') {
      seedData.tasks = [
        {
          eventId,
          category: 'HOTEL_COORDINATION',
          title: 'Salon düzeni planlama',
          description: 'Masa sayısı, sahne, kürsü yerleşimi planlama',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'HOTEL_COORDINATION',
          title: 'Ses–ışık sistemi kontrolü',
          description: 'Ses ve ışık sistemlerinin test edilmesi ve kontrolü',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'HOTEL_COORDINATION',
          title: 'İftar menüsü son onayı',
          description: 'İftar menüsünün final onayı ve mutabakat',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'HOTEL_COORDINATION',
          title: 'Servis saatleri planlama',
          description: 'İftar vakti senkronu ile servis saatlerinin belirlenmesi',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'HOTEL_COORDINATION',
          title: 'Teknik ekip ve sorumlu kişi belirlenmesi',
          description: 'Otel teknik ekibi ve organizasyon sorumlusu belirlenmesi',
          priority: 'MEDIUM',
        },
      ]

      seedData.checklist = [
        {
          eventId,
          category: 'HOTEL_COORDINATION',
          title: 'Salon düzeni onaylandı',
          description: 'Masa sayısı, sahne ve kürsü yerleşimi onaylandı',
        },
        {
          eventId,
          category: 'HOTEL_COORDINATION',
          title: 'Ses-ışık sistemi test edildi',
          description: 'Tüm teknik sistemler test edildi ve hazır',
        },
        {
          eventId,
          category: 'HOTEL_COORDINATION',
          title: 'Menü onaylandı',
          description: 'İftar menüsü final onayı alındı',
        },
        {
          eventId,
          category: 'HOTEL_COORDINATION',
          title: 'Otel ile yazılı mutabakat',
          description: 'Tüm detaylar yazılı olarak otel ile mutabakata varıldı',
        },
      ]
    } else if (category === 'SAHUR_COORDINATION') {
      seedData.tasks = [
        {
          eventId,
          category: 'SAHUR_COORDINATION',
          title: 'Sahur ikramı kararı',
          description: 'Sahur ikramı olup olmayacağının netleştirilmesi',
          priority: 'MEDIUM',
        },
        {
          eventId,
          category: 'SAHUR_COORDINATION',
          title: 'Sahur menüsü ve servis saati',
          description: 'Sahur menüsü ve servis saatlerinin belirlenmesi',
          priority: 'MEDIUM',
        },
        {
          eventId,
          category: 'SAHUR_COORDINATION',
          title: 'Katılımcı listesi oluşturma',
          description: 'Sahur ikramına katılacak misafir listesi',
          priority: 'LOW',
        },
        {
          eventId,
          category: 'SAHUR_COORDINATION',
          title: 'Otel mutfağı ile planlama',
          description: 'Otel mutfağı ile sahur menüsü ve servis planlaması',
          priority: 'MEDIUM',
        },
      ]

      seedData.checklist = [
        {
          eventId,
          category: 'SAHUR_COORDINATION',
          title: 'Sahur kararı verildi',
          description: 'Sahur ikramı yapılıp yapılmayacağı netleştirildi',
        },
        {
          eventId,
          category: 'SAHUR_COORDINATION',
          title: 'Sahur planı hazır',
          description: 'Menü, servis saati ve katılımcı listesi hazır',
        },
        {
          eventId,
          category: 'SAHUR_COORDINATION',
          title: 'Otel mutfağı ile koordinasyon',
          description: 'Otel mutfağı ile sahur planlaması tamamlandı',
        },
      ]
    } else if (category === 'MUSIC_TEAM') {
      seedData.tasks = [
        {
          eventId,
          category: 'MUSIC_TEAM',
          title: 'Müzik tercihi belirlenmesi',
          description: 'İlahi / tasavvuf / fon müziği tercihinin belirlenmesi',
          priority: 'MEDIUM',
        },
        {
          eventId,
          category: 'MUSIC_TEAM',
          title: 'Canlı mı, kayıt mı kararı',
          description: 'Canlı müzik mi yoksa kayıt müzik mi kullanılacağına karar verilmesi',
          priority: 'MEDIUM',
        },
        {
          eventId,
          category: 'MUSIC_TEAM',
          title: 'Ses denemesi (soundcheck)',
          description: 'Etkinlik öncesi ses sisteminin test edilmesi',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'MUSIC_TEAM',
          title: 'Programda müziğin yeri ve süresi',
          description: 'Müziğin program içindeki yeri ve sürelerinin belirlenmesi',
          priority: 'MEDIUM',
        },
      ]

      seedData.checklist = [
        {
          eventId,
          category: 'MUSIC_TEAM',
          title: 'Müzik tercihi belirlendi',
          description: 'İlahi/tasavvuf/fon müziği tercihi netleştirildi',
        },
        {
          eventId,
          category: 'MUSIC_TEAM',
          title: 'Müzik formatı kararlaştırıldı',
          description: 'Canlı veya kayıt müzik kararı verildi',
        },
        {
          eventId,
          category: 'MUSIC_TEAM',
          title: 'Soundcheck tamamlandı',
          description: 'Ses denemesi yapıldı ve sistem hazır',
        },
        {
          eventId,
          category: 'MUSIC_TEAM',
          title: 'Müzik akış planı hazır',
          description: 'Programda müziğin yeri ve süreleri belirlendi',
        },
      ]
    } else if (category === 'SPEAKER') {
      seedData.tasks = [
        {
          eventId,
          category: 'SPEAKER',
          title: 'Konuşmacının kesinleştirilmesi',
          description: 'Konuşmacının kesin olarak belirlenmesi ve teyidi',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'SPEAKER',
          title: 'Konuşma süresi belirlenmesi',
          description: 'İdeal: 7–12 dakika konuşma süresi planlaması',
          priority: 'MEDIUM',
        },
        {
          eventId,
          category: 'SPEAKER',
          title: 'Konuşma içeriği başlıkları',
          description: 'Konuşma içeriğinin ana başlıklarının belirlenmesi',
          priority: 'MEDIUM',
        },
        {
          eventId,
          category: 'SPEAKER',
          title: 'Sahne çıkış sırası',
          description: 'Konuşmacının sahneye çıkış sırasının belirlenmesi',
          priority: 'MEDIUM',
        },
        {
          eventId,
          category: 'SPEAKER',
          title: 'Mikrofon ve kürsü düzeni',
          description: 'Mikrofon ve kürsü yerleşiminin kontrol edilmesi',
          priority: 'HIGH',
        },
      ]

      seedData.checklist = [
        {
          eventId,
          category: 'SPEAKER',
          title: 'Konuşmacı kesinleştirildi',
          description: 'Konuşmacı belirlendi ve teyit edildi',
        },
        {
          eventId,
          category: 'SPEAKER',
          title: 'Konuşma süresi belirlendi',
          description: 'Konuşma süresi (7-12 dk) planlandı',
        },
        {
          eventId,
          category: 'SPEAKER',
          title: 'Konuşma içeriği hazır',
          description: 'Konuşma başlıkları ve içeriği hazırlandı',
        },
        {
          eventId,
          category: 'SPEAKER',
          title: 'Konuşma akışı hazır',
          description: 'Sahne çıkış sırası ve teknik düzen hazır',
        },
      ]
    } else if (category === 'HEADQUARTERS') {
      seedData.tasks = [
        {
          eventId,
          category: 'HEADQUARTERS',
          title: 'Tüm ekiplerin tek merkezden yönetimi',
          description: 'Tüm organizasyon ekiplerinin merkezi koordinasyonu',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'HEADQUARTERS',
          title: 'Günlük koordinasyon grubu oluşturma',
          description: 'WhatsApp/Signal koordinasyon grubu kurulumu',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'HEADQUARTERS',
          title: 'Organizasyon sorumlusu atanması',
          description: 'Ana organizasyon sorumlusunun belirlenmesi',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'HEADQUARTERS',
          title: 'Etkinlik günü zaman çizelgesi (timeline)',
          description: 'Dakika dakika etkinlik akış planının hazırlanması',
          priority: 'HIGH',
        },
        {
          eventId,
          category: 'HEADQUARTERS',
          title: 'Kriz & hızlı karar mekanizması',
          description: 'Acil durumlarda hızlı karar alma mekanizması',
          priority: 'MEDIUM',
        },
      ]

      seedData.checklist = [
        {
          eventId,
          category: 'HEADQUARTERS',
          title: 'Koordinasyon grubu aktif',
          description: 'WhatsApp/Signal koordinasyon grubu kuruldu ve aktif',
        },
        {
          eventId,
          category: 'HEADQUARTERS',
          title: 'Organizasyon sorumlusu atandı',
          description: 'Ana organizasyon sorumlusu belirlendi',
        },
        {
          eventId,
          category: 'HEADQUARTERS',
          title: 'Timeline hazır',
          description: 'Dakika dakika etkinlik akış planı hazırlandı',
        },
        {
          eventId,
          category: 'HEADQUARTERS',
          title: 'Ana organizasyon dosyası hazır',
          description: 'Tüm detayları içeren ana organizasyon dosyası tamamlandı',
        },
      ]
    }

    return seedData
  }

  const loadProtocolSeedData = async (eventId: string) => {
    await loadCategorySeedData(eventId, 'PROTOCOL')
  }

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId) return

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          category: categoryInfo.dbCategory,
          title: taskForm.title,
          description: taskForm.description || undefined,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate || undefined,
          status: taskForm.status,
        }),
      })

      if (response.ok) {
        const newTask = await response.json()
        setTasks([newTask, ...tasks])
        setShowTaskModal(false)
        setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', status: 'PENDING' })
      } else {
        const error = await response.json()
        alert(error.error || 'Görev eklenirken hata oluştu')
      }
    } catch (error) {
      console.error('Görev ekleme hatası:', error)
      alert('Görev eklenirken hata oluştu')
    }
  }

  const handleStartEditTask = (task: any) => {
    setEditingTask(task.id)
    setTaskForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      status: task.status,
    })
    setShowTaskModal(true)
  }

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId || !editingTask) return

    try {
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTask,
          title: taskForm.title,
          description: taskForm.description || undefined,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate || undefined,
          status: taskForm.status,
        }),
      })

      if (response.ok) {
        const updated = await response.json()
        setTasks(tasks.map(task => task.id === editingTask ? updated : task))
        setShowTaskModal(false)
        setEditingTask(null)
        setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', status: 'PENDING' })
      } else {
        const error = await response.json()
        alert(error.error || 'Görev güncellenirken hata oluştu')
      }
    } catch (error) {
      console.error('Görev güncelleme hatası:', error)
      alert('Görev güncellenirken hata oluştu')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Bu görevi silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      const response = await fetch(`/api/tasks?id=${taskId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setTasks(tasks.filter(task => task.id !== taskId))
      } else {
        const error = await response.json()
        alert(error.error || 'Görev silinirken hata oluştu')
      }
    } catch (error) {
      console.error('Görev silme hatası:', error)
      alert('Görev silinirken hata oluştu')
    }
  }

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId) return

    try {
      const response = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          category: categoryInfo.dbCategory,
          title: checklistForm.title,
          description: checklistForm.description || undefined,
          dueDate: checklistForm.dueDate || undefined,
          status: checklistForm.status,
        }),
      })

      if (response.ok) {
        const newItem = await response.json()
        setChecklistItems([newItem, ...checklistItems])
        setShowChecklistModal(false)
        setEditingChecklist(null)
        setChecklistForm({ title: '', description: '', dueDate: '', status: 'NOT_STARTED' })
      } else {
        const error = await response.json()
        alert(error.error || 'Checklist öğesi eklenirken hata oluştu')
      }
    } catch (error) {
      console.error('Checklist ekleme hatası:', error)
      alert('Checklist öğesi eklenirken hata oluştu')
    }
  }

  const handleStartEditChecklist = (item: any) => {
    setEditingChecklist(item.id)
    setChecklistForm({
      title: item.title,
      description: item.description || '',
      dueDate: item.dueDate ? new Date(item.dueDate).toISOString().split('T')[0] : '',
      status: item.status,
    })
    setShowChecklistModal(true)
  }

  const handleUpdateChecklist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId || !editingChecklist) return

    try {
      const response = await fetch('/api/checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingChecklist,
          title: checklistForm.title,
          description: checklistForm.description || undefined,
          dueDate: checklistForm.dueDate || undefined,
          status: checklistForm.status,
        }),
      })

      if (response.ok) {
        const updated = await response.json()
        setChecklistItems(checklistItems.map(item => item.id === editingChecklist ? updated : item))
        setShowChecklistModal(false)
        setEditingChecklist(null)
        setChecklistForm({ title: '', description: '', dueDate: '', status: 'NOT_STARTED' })
      } else {
        const error = await response.json()
        alert(error.error || 'Checklist öğesi güncellenirken hata oluştu')
      }
    } catch (error) {
      console.error('Checklist güncelleme hatası:', error)
      alert('Checklist öğesi güncellenirken hata oluştu')
    }
  }

  const handleDeleteChecklist = async (itemId: string) => {
    if (!confirm('Bu checklist öğesini silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      const response = await fetch(`/api/checklist?id=${itemId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setChecklistItems(checklistItems.filter(item => item.id !== itemId))
      } else {
        const error = await response.json()
        alert(error.error || 'Checklist öğesi silinirken hata oluştu')
      }
    } catch (error) {
      console.error('Checklist silme hatası:', error)
      alert('Checklist öğesi silinirken hata oluştu')
    }
  }

  const handleToggleChecklist = async (itemId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED'
      const response = await fetch('/api/checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: itemId,
          status: newStatus,
        }),
      })

      if (response.ok) {
        const updated = await response.json()
        setChecklistItems(checklistItems.map(item => 
          item.id === itemId ? updated : item
        ))
      }
    } catch (error) {
      console.error('Checklist güncelleme hatası:', error)
    }
  }

  const loadVipGuests = async (eventId: string) => {
    try {
      const response = await fetch(`/api/guests?eventId=${eventId}`)
      if (response.ok) {
        const allGuests = await response.json()
        const vip = allGuests.filter((guest: any) => guest.isVip === true)
        setVipGuests(vip)
      }
    } catch (error) {
      console.error('VIP-Gäste yükleme hatası:', error)
    }
  }

  const handleGuestUpdate = async (guestId: string, field: string, value: any) => {
    try {
      const updateData: any = { id: guestId }
      updateData[field] = value

      const response = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        const updated = await response.json()
        setVipGuests(vipGuests.map(guest => 
          guest.id === guestId ? updated : guest
        ))
        setEditingGuest(null)
        setGuestEditData({})
      } else {
        const error = await response.json()
        alert(error.error || 'Güncelleme başarısız')
      }
    } catch (error) {
      console.error('Gast güncelleme hatası:', error)
      alert('Güncelleme sırasında hata oluştu')
    }
  }

  const handleStartEdit = (guest: any) => {
    setEditingGuest(guest.id)
    setGuestEditData({
      name: guest.name,
      title: guest.title || '',
      organization: guest.organization || '',
      email: guest.email || '',
      phone: guest.phone || '',
      tableNumber: guest.tableNumber || '',
      status: guest.status,
    })
  }

  const handleSaveEdit = async (guestId: string) => {
    try {
      const response = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guestId,
          ...guestEditData,
        }),
      })

      if (response.ok) {
        const updated = await response.json()
        setVipGuests(vipGuests.map(guest => 
          guest.id === guestId ? updated : guest
        ))
        setEditingGuest(null)
        setGuestEditData({})
      } else {
        const error = await response.json()
        alert(error.error || 'Güncelleme başarısız')
      }
    } catch (error) {
      console.error('Gast güncelleme hatası:', error)
      alert('Güncelleme sırasında hata oluştu')
    }
  }

  const loadReceptionGuests = async (eventId: string) => {
    try {
      const response = await fetch(`/api/guests?eventId=${eventId}&needsReception=true`)
      if (response.ok) {
        const guests = await response.json()
        setReceptionGuests(guests)
      }
    } catch (error) {
      console.error('Empfangs-Gäste yükleme hatası:', error)
    }
  }

  const handleStartReceptionEdit = (guest: any) => {
    setEditingReceptionGuest(guest.id)
    // Format für datetime-local: YYYY-MM-DDTHH:mm
    const formatDateTimeLocal = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }
    setReceptionGuestEditData({
      name: guest.name,
      title: guest.title || '',
      organization: guest.organization || '',
      email: guest.email || '',
      phone: guest.phone || '',
      receptionBy: guest.receptionBy || '',
      arrivalDate: guest.arrivalDate ? formatDateTimeLocal(new Date(guest.arrivalDate)) : '',
      status: guest.status,
    })
  }

  const handleSaveReceptionEdit = async (guestId: string) => {
    try {
      const response = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guestId,
          ...receptionGuestEditData,
        }),
      })

      if (response.ok) {
        const updated = await response.json()
        setReceptionGuests(receptionGuests.map(guest => 
          guest.id === guestId ? updated : guest
        ))
        setEditingReceptionGuest(null)
        setReceptionGuestEditData({})
      } else {
        const error = await response.json()
        alert(error.error || 'Güncelleme başarısız')
      }
    } catch (error) {
      console.error('Gast güncelleme hatası:', error)
      alert('Güncelleme sırasında hata oluştu')
    }
  }

  if (!categoryInfo) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                ← Geri
              </Link>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${categoryInfo.color} text-xl text-white`}>
                  {categoryInfo.icon}
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{categoryInfo.name}</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Checklist Section */}
          <div className="rounded-xl bg-white p-6 shadow-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Checklist</h2>
              <button 
                onClick={() => setShowChecklistModal(true)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                + Yeni Öğe
              </button>
            </div>
            <div className="space-y-3">
              {loading ? (
                <p className="text-gray-500">Yükleniyor...</p>
              ) : checklistItems.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                  <p className="text-gray-500">Henüz checklist öğesi eklenmemiş</p>
                  <button 
                    onClick={() => setShowChecklistModal(true)}
                    className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    İlk Öğeyi Ekle
                  </button>
                </div>
              ) : (
                checklistItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                    <input 
                      type="checkbox" 
                      className="h-5 w-5" 
                      checked={item.status === 'COMPLETED'}
                      onChange={() => handleToggleChecklist(item.id, item.status)}
                    />
                    <div className="flex-1">
                      <p className={`font-medium ${item.status === 'COMPLETED' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-sm text-gray-500">{item.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartEditChecklist(item)}
                        className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700"
                        title="Bearbeiten"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDeleteChecklist(item.id)}
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                        title="Löschen"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tasks Section */}
          <div className="rounded-xl bg-white p-6 shadow-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Görevler</h2>
              <div className="flex gap-2">
                {tasks.length === 0 && (
                  <button 
                    onClick={() => loadCategorySeedData(eventId!, categoryInfo.dbCategory)}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    📋 {categoryInfo.name} Planını Yükle
                  </button>
                )}
                <button 
                  onClick={() => setShowTaskModal(true)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  + Yeni Görev
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {loading ? (
                <p className="text-gray-500">Yükleniyor...</p>
              ) : tasks.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                  <p className="text-gray-500">Henüz görev eklenmemiş</p>
                  <button 
                    onClick={() => setShowTaskModal(true)}
                    className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    İlk Görevi Ekle
                  </button>
                </div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{task.title}</h3>
                        {task.description && (
                          <p className="mt-1 text-sm text-gray-600">{task.description}</p>
                        )}
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          <span>Durum: {task.status}</span>
                          <span>Öncelik: {task.priority}</span>
                          {task.dueDate && (
                            <span>Bitiş: {new Date(task.dueDate).toLocaleDateString('tr-TR')}</span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => handleStartEditTask(task)}
                          className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700"
                          title="Bearbeiten"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                          title="Löschen"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* VIP Guests Section - nur für Protokoll */}
        {categoryInfo.dbCategory === 'PROTOCOL' && (
          <div className="mt-8 rounded-xl bg-white p-6 shadow-md">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⭐</span>
                <h2 className="text-xl font-semibold text-gray-900">VIP Misafirler</h2>
                <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
                  {vipGuests.length} VIP
                </span>
              </div>
              <button
                onClick={() => loadVipGuests(eventId!)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                🔄 Yenile
              </button>
            </div>
            
            {vipGuests.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                <p className="text-gray-500">Henüz VIP misafir eklenmemiş</p>
                <Link
                  href="/dashboard/guests"
                  className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Gäste-Liste öffnen
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">VIP</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">Titel</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">Organisation</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">E-Mail</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">Telefon</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">VIP Tisch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vipGuests.map((guest) => (
                      <tr
                        key={guest.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${
                          editingGuest === guest.id ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="text-yellow-500">⭐</span>
                        </td>
                        <td className="px-4 py-3">
                          {editingGuest === guest.id ? (
                            <input
                              type="text"
                              value={guestEditData.name}
                              onChange={(e) => setGuestEditData({ ...guestEditData, name: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            <span className="font-medium text-gray-900">{guest.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingGuest === guest.id ? (
                            <input
                              type="text"
                              value={guestEditData.title}
                              onChange={(e) => setGuestEditData({ ...guestEditData, title: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              placeholder="Titel"
                            />
                          ) : (
                            <span className="text-sm text-gray-600">{guest.title || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingGuest === guest.id ? (
                            <input
                              type="text"
                              value={guestEditData.organization}
                              onChange={(e) => setGuestEditData({ ...guestEditData, organization: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              placeholder="Organisation"
                            />
                          ) : (
                            <span className="text-sm text-gray-600">{guest.organization || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingGuest === guest.id ? (
                            <input
                              type="email"
                              value={guestEditData.email}
                              onChange={(e) => setGuestEditData({ ...guestEditData, email: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              placeholder="E-Mail"
                            />
                          ) : (
                            <span className="text-sm text-gray-600">{guest.email || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingGuest === guest.id ? (
                            <input
                              type="tel"
                              value={guestEditData.phone}
                              onChange={(e) => setGuestEditData({ ...guestEditData, phone: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              placeholder="Telefon"
                            />
                          ) : (
                            <span className="text-sm text-gray-600">{guest.phone || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingGuest === guest.id ? (
                            <input
                              type="number"
                              value={guestEditData.tableNumber}
                              onChange={(e) => setGuestEditData({ ...guestEditData, tableNumber: e.target.value ? parseInt(e.target.value) : null })}
                              className="w-20 rounded border border-gray-300 px-2 py-1 text-sm font-semibold text-yellow-700"
                              placeholder="Tisch #"
                              min="1"
                            />
                          ) : (
                            <span className="font-semibold text-yellow-700">
                              {guest.tableNumber ? `VIP-${guest.tableNumber}` : '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingGuest === guest.id ? (
                            <select
                              value={guestEditData.status}
                              onChange={(e) => setGuestEditData({ ...guestEditData, status: e.target.value })}
                              className="rounded border border-gray-300 px-2 py-1 text-sm"
                            >
                              <option value="INVITED">Eingeladen</option>
                              <option value="CONFIRMED">Bestätigt</option>
                              <option value="ATTENDED">Anwesend</option>
                              <option value="CANCELLED">Abgesagt</option>
                              <option value="NO_SHOW">Nicht erschienen</option>
                            </select>
                          ) : (
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                              guest.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                              guest.status === 'ATTENDED' ? 'bg-blue-100 text-blue-800' :
                              guest.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {guest.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingGuest === guest.id ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveEdit(guest.id)}
                                className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  setEditingGuest(null)
                                  setGuestEditData({})
                                }}
                                className="rounded bg-gray-400 px-2 py-1 text-xs text-white hover:bg-gray-500"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(guest)}
                              className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700"
                            >
                              ✎ Bearbeiten
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Reception Guests Section - nur für Guest Reception */}
        {categoryInfo.dbCategory === 'GUEST_RECEPTION' && (
          <div className="mt-8 rounded-xl bg-white p-6 shadow-md">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🚪</span>
                <h2 className="text-xl font-semibold text-gray-900">Besonderer Empfang</h2>
                <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
                  {receptionGuests.length} Gäste
                </span>
              </div>
              <button
                onClick={() => loadReceptionGuests(eventId!)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                🔄 Yenile
              </button>
            </div>
            
            {receptionGuests.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                <p className="text-gray-500">Keine Gäste mit besonderem Empfang</p>
                <Link
                  href="/dashboard/guests"
                  className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Gäste-Liste öffnen
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">Titel</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">Organisation</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">E-Mail</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">Telefon</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">Empfangen von</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">Anreisedatum & Uhrzeit</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-700">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receptionGuests.map((guest) => (
                      <tr
                        key={guest.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${
                          editingReceptionGuest === guest.id ? 'bg-purple-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          {editingReceptionGuest === guest.id ? (
                            <input
                              type="text"
                              value={receptionGuestEditData.name}
                              onChange={(e) => setReceptionGuestEditData({ ...receptionGuestEditData, name: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            <span className="font-medium text-gray-900">{guest.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingReceptionGuest === guest.id ? (
                            <input
                              type="text"
                              value={receptionGuestEditData.title}
                              onChange={(e) => setReceptionGuestEditData({ ...receptionGuestEditData, title: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              placeholder="Titel"
                            />
                          ) : (
                            <span className="text-sm text-gray-600">{guest.title || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingReceptionGuest === guest.id ? (
                            <input
                              type="text"
                              value={receptionGuestEditData.organization}
                              onChange={(e) => setReceptionGuestEditData({ ...receptionGuestEditData, organization: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              placeholder="Organisation"
                            />
                          ) : (
                            <span className="text-sm text-gray-600">{guest.organization || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingReceptionGuest === guest.id ? (
                            <input
                              type="email"
                              value={receptionGuestEditData.email}
                              onChange={(e) => setReceptionGuestEditData({ ...receptionGuestEditData, email: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              placeholder="E-Mail"
                            />
                          ) : (
                            <span className="text-sm text-gray-600">{guest.email || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingReceptionGuest === guest.id ? (
                            <input
                              type="tel"
                              value={receptionGuestEditData.phone}
                              onChange={(e) => setReceptionGuestEditData({ ...receptionGuestEditData, phone: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              placeholder="Telefon"
                            />
                          ) : (
                            <span className="text-sm text-gray-600">{guest.phone || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingReceptionGuest === guest.id ? (
                            <input
                              type="text"
                              value={receptionGuestEditData.receptionBy}
                              onChange={(e) => setReceptionGuestEditData({ ...receptionGuestEditData, receptionBy: e.target.value })}
                              className="w-full rounded border border-purple-300 px-2 py-1 text-sm font-semibold text-purple-700"
                              placeholder="Empfänger"
                            />
                          ) : (
                            <span className="font-semibold text-purple-700">
                              {guest.receptionBy || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingReceptionGuest === guest.id ? (
                            <input
                              type="datetime-local"
                              value={receptionGuestEditData.arrivalDate}
                              onChange={(e) => setReceptionGuestEditData({ ...receptionGuestEditData, arrivalDate: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            <span className="text-sm text-gray-600">
                              {guest.arrivalDate ? (
                                <>
                                  {new Date(guest.arrivalDate).toLocaleDateString('de-DE')} {new Date(guest.arrivalDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                </>
                              ) : '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingReceptionGuest === guest.id ? (
                            <select
                              value={receptionGuestEditData.status}
                              onChange={(e) => setReceptionGuestEditData({ ...receptionGuestEditData, status: e.target.value })}
                              className="rounded border border-gray-300 px-2 py-1 text-sm"
                            >
                              <option value="INVITED">Eingeladen</option>
                              <option value="CONFIRMED">Bestätigt</option>
                              <option value="ATTENDED">Anwesend</option>
                              <option value="CANCELLED">Abgesagt</option>
                              <option value="NO_SHOW">Nicht erschienen</option>
                            </select>
                          ) : (
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                              guest.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                              guest.status === 'ATTENDED' ? 'bg-blue-100 text-blue-800' :
                              guest.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {guest.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingReceptionGuest === guest.id ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveReceptionEdit(guest.id)}
                                className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  setEditingReceptionGuest(null)
                                  setReceptionGuestEditData({})
                                }}
                                className="rounded bg-gray-400 px-2 py-1 text-xs text-white hover:bg-gray-500"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartReceptionEdit(guest)}
                              className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700"
                            >
                              ✎ Bearbeiten
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Notes Section */}
        <div className="mt-8 rounded-xl bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Notlar</h2>
          <textarea
            className="w-full rounded-lg border border-gray-300 p-4 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={4}
            placeholder="Bu alan için notlarınızı buraya yazabilirsiniz..."
          />
          <button className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Notu Kaydet
          </button>
        </div>
      </main>

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold">
              {editingTask ? 'Görev Bearbeiten' : 'Yeni Görev Ekle'}
            </h2>
            <form onSubmit={editingTask ? handleUpdateTask : handleAddTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Başlık *</label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Açıklama</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Öncelik</label>
                <select
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="LOW">Düşük</option>
                  <option value="MEDIUM">Orta</option>
                  <option value="HIGH">Yüksek</option>
                  <option value="URGENT">Acil</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={taskForm.status}
                  onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="PENDING">Ausstehend</option>
                  <option value="IN_PROGRESS">In Bearbeitung</option>
                  <option value="COMPLETED">Abgeschlossen</option>
                  <option value="BLOCKED">Blockiert</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bitiş Tarihi</label>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {editingTask ? 'Güncelle' : 'Kaydet'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTaskModal(false)
                    setEditingTask(null)
                    setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', status: 'PENDING' })
                  }}
                  className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checklist Modal */}
      {showChecklistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold">
              {editingChecklist ? 'Checklist Öğesi Bearbeiten' : 'Yeni Checklist Öğesi Ekle'}
            </h2>
            <form onSubmit={editingChecklist ? handleUpdateChecklist : handleAddChecklist} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Başlık *</label>
                <input
                  type="text"
                  required
                  value={checklistForm.title}
                  onChange={(e) => setChecklistForm({ ...checklistForm, title: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Açıklama</label>
                <textarea
                  value={checklistForm.description}
                  onChange={(e) => setChecklistForm({ ...checklistForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={checklistForm.status}
                  onChange={(e) => setChecklistForm({ ...checklistForm, status: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="NOT_STARTED">Nicht gestartet</option>
                  <option value="IN_PROGRESS">In Bearbeitung</option>
                  <option value="COMPLETED">Abgeschlossen</option>
                  <option value="BLOCKED">Blockiert</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bitiş Tarihi</label>
                <input
                  type="date"
                  value={checklistForm.dueDate}
                  onChange={(e) => setChecklistForm({ ...checklistForm, dueDate: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {editingChecklist ? 'Güncelle' : 'Kaydet'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowChecklistModal(false)
                    setEditingChecklist(null)
                    setChecklistForm({ title: '', description: '', dueDate: '', status: 'NOT_STARTED' })
                  }}
                  className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
