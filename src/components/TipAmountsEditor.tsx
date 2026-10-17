import React, { useEffect, useState } from 'react'
import { Button, InputNumber, Space } from 'antd'
import { DEFAULT_TIP_AMOUNTS, MAX_TIP_AMOUNT, MIN_TIP_AMOUNT, validateTipAmounts } from '../utils/deviceConfig'

interface TipAmountsEditorProps {
  amounts: number[]
  saving: boolean
  onSave: (amounts: number[]) => void
  onReset: () => void
}

// Edits the six tip amounts offered on a performer's tip page
const TipAmountsEditor: React.FC<TipAmountsEditorProps> = ({ amounts, saving, onSave, onReset }) => {
  const [draft, setDraft] = useState<number[]>(amounts)

  useEffect(() => setDraft(amounts), [amounts])

  const error = validateTipAmounts(draft)
  const unchanged = draft.every((value, i) => value === amounts[i])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-purple-200 p-4">
      <h3 className="text-lg font-semibold text-gray-900">Tip Amounts</h3>
      <p className="text-sm text-gray-600 mb-3">
        The six amounts shown on the tip page. Whole dollars from ${MIN_TIP_AMOUNT} to ${MAX_TIP_AMOUNT}, lowest to highest.
        Default: {DEFAULT_TIP_AMOUNTS.map(a => `$${a}`).join(', ')}.
      </p>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {draft.map((value, index) => (
          <InputNumber
            key={index}
            min={MIN_TIP_AMOUNT}
            max={MAX_TIP_AMOUNT}
            precision={0}
            prefix="$"
            style={{ width: '100%' }}
            value={value}
            disabled={saving}
            onChange={(next) => setDraft(prev => prev.map((v, i) => (i === index ? Number(next) || 0 : v)))}
          />
        ))}
      </div>
      {error && !unchanged && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <Space className="mt-3">
        <Button type="primary" onClick={() => onSave(draft)} loading={saving} disabled={!!error || unchanged}>
          Save amounts
        </Button>
        <Button onClick={onReset} disabled={saving}>Reset to defaults</Button>
      </Space>
    </div>
  )
}

export default TipAmountsEditor
