import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLobbyForm } from '../../components/lobby/useLobbyForm'
import { toggleOption } from '../../components/lobby/lobbyForm'
import { Button } from '../../components/ui/Button'
import { FilterChip } from '../../components/ui/FilterChip'
import { SelectField, TextInput } from '../../components/ui/FormField'
import {
  availabilityOptions, cuisineOptions, diningNeedOptions, distanceOptions, priceOptions, ratingOptions,
  formatPreferenceAvailability, formatPreferenceDistance, preferenceValidators, preferencesFromFields,
} from './restaurantPreferences'
import type { PreferenceFields, RestaurantPreferences } from './restaurantPreferences'

/** A temporary draft: only Apply changes shared settings; Cancel leaves them untouched. */
export function RestaurantFilterEditor({ filters, variant, onApply, onCancel }: {
  filters: RestaurantPreferences
  variant: 'lobby' | 'discovery'
  onApply: (filters: RestaurantPreferences) => void
  onCancel: () => void
}) {
  const { values, errors, setValue, onBlur, validate } = useLobbyForm<PreferenceFields>({
    location: filters.location, date: filters.date, time: filters.time,
    distance: filters.distance, rating: filters.rating, availability: filters.availability,
  }, preferenceValidators)
  const [cuisines, setCuisines] = useState([...filters.cuisines])
  const [prices, setPrices] = useState([...filters.prices])
  const [diningNeeds, setDiningNeeds] = useState([...filters.diningNeeds])
  const prefix = variant === 'lobby' ? 'lobby' : 'discovery'
  const groupClass = variant === 'lobby' ? 'lobby-filter-editor__group' : undefined

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (validate(event.currentTarget)) onApply(preferencesFromFields(values, { cuisines, prices, diningNeeds }))
  }

  return (
    <form id={`${prefix}-filter-form`} className={`${prefix}-filter-editor`} noValidate onSubmit={submit} aria-label="Edit demonstration filters">
      {variant === 'discovery' && <h2 className="text-heading-h2">Edit filters</h2>}
      <p className="text-caption-default">Apply shares temporary settings across this lobby’s screens. Sample restaurants and existing votes stay unchanged. Reset restores demo defaults.</p>
      <div className={`${prefix}-filter-editor__fields`}>
        <TextInput label="Location" name="location" required maxLength={120} autoFocus value={values.location} error={errors.location} onChange={event => setValue('location', event.target.value)} onBlur={() => onBlur('location')} />
        <TextInput label="Dining date (demo)" name="date" type="date" hint="Leave blank for any date." value={values.date} error={errors.date} onChange={event => setValue('date', event.target.value)} onBlur={() => onBlur('date')} />
        <TextInput label="Dining time (demo)" name="time" type="time" hint="Leave blank for any time." value={values.time} error={errors.time} onChange={event => setValue('time', event.target.value)} onBlur={() => onBlur('time')} />
        <SelectField label="Distance" name="distance" value={values.distance} error={errors.distance} onChange={event => setValue('distance', event.target.value)} onBlur={() => onBlur('distance')}>
          <option value="any">Any distance</option>
          {distanceOptions.map(value => <option key={value} value={value}>{formatPreferenceDistance(value)}</option>)}
        </SelectField>
        <SelectField label="Minimum rating" name="rating" value={values.rating} error={errors.rating} onChange={event => setValue('rating', event.target.value)} onBlur={() => onBlur('rating')}>
          {ratingOptions.map(value => <option key={value} value={value}>{value === 'any' ? 'Any rating' : `${value}+`}</option>)}
        </SelectField>
        <SelectField label="Availability" name="availability" value={values.availability} error={errors.availability} onChange={event => setValue('availability', event.target.value)} onBlur={() => onBlur('availability')}>
          {availabilityOptions.map(value => <option key={value} value={value}>{value === 'atDiningTime' ? 'At dining time' : formatPreferenceAvailability(value)}</option>)}
        </SelectField>
      </div>
      <fieldset className={groupClass}>
        <legend>Cuisine</legend>
        <div className={`${prefix}-filter-chips`}>{cuisineOptions.map(value => <FilterChip key={value} selected={cuisines.includes(value)} onClick={() => setCuisines(previous => toggleOption(previous, value))}>{value}</FilterChip>)}</div>
      </fieldset>
      <fieldset className={groupClass}>
        <legend>Price</legend>
        <div className={`${prefix}-filter-chips`}>{priceOptions.map(value => <FilterChip key={value} selected={prices.includes(value)} onClick={() => setPrices(previous => toggleOption(previous, value))}>{value}</FilterChip>)}</div>
      </fieldset>
      <fieldset className={groupClass}>
        <legend>Dining needs</legend>
        <div className={`${prefix}-filter-chips`}>{diningNeedOptions.map(value => <FilterChip key={value} selected={diningNeeds.includes(value)} onClick={() => setDiningNeeds(previous => toggleOption(previous, value))}>{value}</FilterChip>)}</div>
      </fieldset>
      <div className={variant === 'lobby' ? 'lobby-actions' : 'discovery-filter-editor__actions'}>
        <Button type="submit">Apply locally</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
