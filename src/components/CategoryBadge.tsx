import {
  Utensils,
  ShoppingCart,
  Zap,
  Car,
  ShoppingBag,
  Film,
  HeartPulse,
  Briefcase,
  TrendingUp,
  Tag,
  Home,
  GraduationCap,
  Landmark,
  ArrowRightLeft,
  Wifi,
  Users,
} from 'lucide-react'

export interface CategoryMeta {
  id: string
  name: string
  icon: typeof Tag
  color: string
}

export function getCategoryMeta(categoryIdOrName?: string): CategoryMeta {
  const key = (categoryIdOrName || '').toLowerCase().trim()

  if (/grocer|cook|food shop|supermarket|rewe|edeka|aldi|lidl/.test(key)) {
    return { id: 'groceries', name: 'Groceries & Cooking', icon: ShoppingCart, color: '#10b981' }
  }
  if (/restaurant|takeaway|dining|food|cafe|dinner|lunch|breakfast/.test(key)) {
    return { id: 'food', name: 'Food & Dining', icon: Utensils, color: '#f97316' }
  }
  if (/rent|accommodation|apartment|room|warmmiete|kaltmiete/.test(key)) {
    return { id: 'rent', name: 'Rent & Accommodation', icon: Home, color: '#6366f1' }
  }
  if (/electric|power|heating|gas|water|utility|strom|stadtwerke/.test(key)) {
    return { id: 'utilities', name: 'Electricity & Utilities', icon: Zap, color: '#3b82f6' }
  }
  if (/deutschland|bvg|transport|train|db\b|flight|travel|fuel|car|ticket/.test(key)) {
    return { id: 'transport', name: 'Transportation & Travel', icon: Car, color: '#8b5cf6' }
  }
  if (/shopping|amazon|clothing|dress|personal|dm\b|mediamarkt|electronics/.test(key)) {
    return { id: 'shopping', name: 'Shopping & Personal', icon: ShoppingBag, color: '#ec4899' }
  }
  if (/insurance|health|tk\b|krankenkasse|medical|doctor|apotheke/.test(key)) {
    return { id: 'insurance', name: 'Insurance & Health', icon: HeartPulse, color: '#ef4444' }
  }
  if (/phone|internet|mobile|fibernet|vodafone|o2\b|telekom|sim/.test(key)) {
    return { id: 'internet', name: 'Phone & Internet', icon: Wifi, color: '#06b6d4' }
  }
  if (/subscription|netflix|spotify|prime|apple|software|gym|movie|entertainment/.test(key)) {
    return { id: 'subscriptions', name: 'Subscriptions & Media', icon: Film, color: '#eab308' }
  }
  if (/education|semester|university|books|tuition|passport|visa/.test(key)) {
    return { id: 'education', name: 'Education & Legal', icon: GraduationCap, color: '#14b8a6' }
  }
  if (/salary|earning|wages|income|working student|werkstudent/.test(key)) {
    return { id: 'salary', name: 'Salary & Earnings', icon: Briefcase, color: '#10b981' }
  }
  if (/sip|etf|gold|emergency|invest|trade republic|scalable/.test(key)) {
    return { id: 'investments', name: 'Savings & Investments', icon: TrendingUp, color: '#0ea5e9' }
  }
  if (/repay|debt|loan|appa|anna/.test(key)) {
    return { id: 'debts', name: 'Debt & Repayments', icon: Landmark, color: '#f43f5e' }
  }
  if (/family|gift|support|parents/.test(key)) {
    return { id: 'family', name: 'Family Support', icon: Users, color: '#a855f7' }
  }
  if (/transfer|withdraw|deposit|blocked/.test(key)) {
    return { id: 'transfers', name: 'Account Transfers', icon: ArrowRightLeft, color: '#64748b' }
  }

  return { id: 'other', name: categoryIdOrName || 'Other', icon: Tag, color: '#94a3b8' }
}

export function CategoryIcon({
  category,
  size = 14,
  className = '',
}: {
  category?: string
  size?: number
  className?: string
}) {
  const meta = getCategoryMeta(category)
  const Icon = meta.icon
  return <Icon size={size} className={className} style={{ color: meta.color }} />
}

export function CategoryBadge({
  category,
  label,
  size = 'normal',
}: {
  category?: string
  label?: string
  size?: 'small' | 'normal'
}) {
  const meta = getCategoryMeta(category)
  const Icon = meta.icon
  const text = label || meta.name

  const isSmall = size === 'small'

  return (
    <span
      className="status-pill"
      style={{
        backgroundColor: `${meta.color}14`,
        borderColor: `${meta.color}35`,
        color: meta.color,
        fontWeight: 600,
        fontSize: isSmall ? '0.7rem' : '0.74rem',
        padding: isSmall ? '1px 6px' : '2px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        borderRadius: 999,
        lineHeight: 1.2,
      }}
    >
      <Icon size={isSmall ? 11 : 13} style={{ flexShrink: 0 }} />
      <span>{text}</span>
    </span>
  )
}
