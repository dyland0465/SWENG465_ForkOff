import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { TextAction } from '../components/ui/TextAction'
import { TextInput, SelectField } from '../components/ui/FormField'
import { FilterChip } from '../components/ui/FilterChip'
import { ForkEmblem } from '../components/lobby/ForkEmblem'
import { useLobbyForm } from '../components/lobby/useLobbyForm'
import {
  cuisineOptions, priceOptions, diningOptions, distanceOptions, ratingOptions,
  validateLocation, validateDateTime, initialDinnerTime, formatDinnerTime, toggleOption,
} from '../components/lobby/lobbyForm'
import { paths } from '../routes/paths'
import './LobbyForms.css'

export function CreateLobbyPage() {
  const { values, errors, setValue, onBlur, validate } = useLobbyForm(
    { location: 'Erie, PA', dateTime: initialDinnerTime(), distance: '5', rating: '4.0' },
    {
      location: validateLocation,
      dateTime: validateDateTime,
      distance: value => distanceOptions.some(option => option === value) ? undefined : 'Choose a distance.',
      rating: value => ratingOptions.some(option => option === value) ? undefined : 'Choose a minimum rating.',
    },
  )
  const [cuisines, setCuisines] = useState<string[]>(['Italian', 'Ramen'])
  const [prices, setPrices] = useState<string[]>(['$$'])
  const [diningNeeds, setDiningNeeds] = useState<string[]>(['Open at dining time', 'Mocktails'])
  const [status, setStatus] = useState('')
  const diningTime = new Date(values.dateTime)
  const openLabel = Number.isFinite(diningTime.getTime())
    ? `Open at ${diningTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
    : 'Open at dining time'

  function resetFilters() {
    setValue('distance', '5')
    setValue('rating', 'any')
    setCuisines([])
    setPrices([])
    setDiningNeeds([])
    setStatus('')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus(validate(event.currentTarget)
      ? 'Your settings are valid. Lobby creation will be available when the backend is connected.'
      : 'Check the highlighted fields before continuing.')
  }

  const summary = [
    `Location: ${values.location.trim() || 'Choose a location'}`,
    formatDinnerTime(values.dateTime),
    `${values.distance}-mile radius`,
    cuisines.length ? cuisines.join(' + ') : 'Any cuisine',
    `${prices.length ? prices.join(' / ') : 'Any price'} · ${values.rating === 'any' ? 'Any rating' : `${values.rating}+`}`,
    diningNeeds.length ? diningNeeds.map(option => option === 'Open at dining time' ? openLabel : option).join(' · ') : 'No dining requirements',
  ]

  return (
    <main id="main-content" className="lobby-form-page" tabIndex={-1}>
      <h1 className="text-heading-h1">Create a lobby</h1>
      <p className="lobby-form-page__intro text-body-large">Set the guardrails. Your group can still explore inside them.</p>
      <form className="create-lobby" noValidate onSubmit={submit} onChange={() => setStatus('')} onClick={() => setStatus('')}>
        <div className="create-lobby__filters lobby-panel">
          <div className="create-lobby__fields">
            <TextInput label="Location" name="location" required autoComplete="street-address" value={values.location} error={errors.location} onChange={event => setValue('location', event.target.value)} onBlur={() => onBlur('location')} />
            <SelectField label="Distance" name="distance" value={values.distance} error={errors.distance} onChange={event => setValue('distance', event.target.value)} onBlur={() => onBlur('distance')}>
              {distanceOptions.map(distance => <option key={distance} value={distance}>Within {distance} {distance === '1' ? 'mile' : 'miles'}</option>)}
            </SelectField>
            <TextInput label="Date & time" name="dateTime" type="datetime-local" required value={values.dateTime} error={errors.dateTime} onChange={event => setValue('dateTime', event.target.value)} onBlur={() => onBlur('dateTime')} />
            <SelectField label="Minimum rating" name="rating" value={values.rating} error={errors.rating} onChange={event => setValue('rating', event.target.value)} onBlur={() => onBlur('rating')}>
              {ratingOptions.map(rating => <option key={rating} value={rating}>{rating === 'any' ? 'Any rating' : `${rating} and up`}</option>)}
            </SelectField>
          </div>
          <fieldset className="lobby-filter-group create-lobby__cuisines">
            <legend>Cuisine</legend>
            <div className="lobby-filter-group__options">{cuisineOptions.map(cuisine => <FilterChip key={cuisine} selected={cuisines.includes(cuisine)} onClick={() => setCuisines(previous => toggleOption(previous, cuisine))}>{cuisine}</FilterChip>)}</div>
          </fieldset>
          <div className="create-lobby__preferences">
            <fieldset className="lobby-filter-group">
              <legend>Price</legend>
              <div className="lobby-filter-group__options">{priceOptions.map(price => <FilterChip key={price} selected={prices.includes(price)} onClick={() => setPrices(previous => toggleOption(previous, price))}>{price}</FilterChip>)}</div>
            </fieldset>
            <fieldset className="lobby-filter-group">
              <legend>Dining needs</legend>
              <div className="lobby-filter-group__options">{diningOptions.map(option => <FilterChip key={option} selected={diningNeeds.includes(option)} onClick={() => setDiningNeeds(previous => toggleOption(previous, option))}>{option === 'Open at dining time' ? openLabel : option}</FilterChip>)}</div>
            </fieldset>
          </div>
          <TextAction className="create-lobby__reset" onClick={resetFilters}>Reset filters</TextAction>
          <div className="create-lobby__availability">
            <ForkEmblem />
            <div className="create-lobby__match-note">
              <strong>Restaurant matches pending</strong>
              <p>Match counts will appear when restaurant search is connected.</p>
            </div>
          </div>
        </div>
        <div className="create-lobby__aside">
          <aside className="create-lobby__summary" aria-labelledby="lobby-summary-heading">
            <h2 id="lobby-summary-heading" className="text-heading-h2">Your lobby</h2>
            <ul>{summary.map((line, index) => <li key={index}><span aria-hidden="true">✓</span><span>{line}</span></li>)}</ul>
          </aside>
          <div className="create-lobby__submit">
            <Button type="submit" aria-describedby="create-backend-note">Create lobby</Button>
            <p className="lobby-form-note">You can edit these filters before voting starts.</p>
            <p id="create-backend-note" className="lobby-form-note">Lobby creation is not connected yet.</p>
            <p className="lobby-form-status" role="status">{status}</p>
          </div>
        </div>
      </form>
      <TextAction className="lobby-form-page__back" to={paths.home}>Back to home</TextAction>
    </main>
  )
}
