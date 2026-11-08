import { useAuth } from '../features/auth/useAuth'
import { generatePath, useNavigate, useSearchParams } from 'react-router'
import { useEffect, useRef, useState } from 'react'
import { inviteSavedGroup, listSavedGroups, savedRequest } from '../features/saved/savedApi'
import type { Collection, SavedGroup } from '../features/saved/savedApi'
import { GuestGroupsReminder } from '../features/saved/GuestGroupsReminder'
import { lobbyRequest } from '../features/lobby/liveLobby'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { TextAction } from '../components/ui/TextAction'
import { TextInput, SelectField } from '../components/ui/FormField'
import { FilterChip } from '../components/ui/FilterChip'
import { useLobbyForm } from '../components/lobby/useLobbyForm'
import {
  cuisineOptions, priceOptions, diningOptions, distanceOptions, ratingOptions,
  validateLocation, validateDateTime, validateDisplayName, initialDinnerTime, formatDinnerTime, toggleOption,
} from '../components/lobby/lobbyForm'
import { paths } from '../routes/paths'
import './LobbyForms.css'
import '../features/saved/group-controls.css'

export function CreateLobbyPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const groupId = searchParams.get('group')
  const requestedCollection = searchParams.get('collection') ?? ''
  const [collections, setCollections] = useState<Collection[]>([])
  const [collectionId, setCollectionId] = useState(requestedCollection)
  const [collectionError, setCollectionError] = useState('')
  const { user, loading } = useAuth()
  const groupKey = `${user?.id ?? ''}:${groupId ?? ''}`
  const [groupState, setGroupState] = useState<{ key: string; group?: SavedGroup; error?: string; loading: boolean }>({ key: '', loading: true })
  const [groupRetry, setGroupRetry] = useState(0)
  const groupLoading = !!user && !!groupId && (groupState.key !== groupKey || groupState.loading)
  const selectedGroup = groupState.key === groupKey ? groupState.group : undefined
  const groupError = groupState.key === groupKey ? groupState.error : undefined
  useEffect(() => {
    if (!user || !groupId) return
    let active = true
    listSavedGroups().then(result => {
      if (!active) return
      const group = result.groups.find(item => item._id === groupId)
      setGroupState({ key: groupKey, loading: false, group, ...(!group ? { error: 'This saved group is unavailable. It may have been deleted, or belong to a different account.' } : {}) })
    }).catch(error => {
      if (active) setGroupState({ key: groupKey, loading: false, error: error instanceof Error ? error.message : 'Could not load this saved group.' })
    })
    return () => { active = false }
  }, [user, groupId, groupKey, groupRetry])
  useEffect(() => {
    if (!user) return
    let active = true
    savedRequest<{ collections: Collection[] }>('/collections').then(result => { if (active) setCollections(result.collections) }).catch(() => { if (active) setCollectionError('Could not load collections. Please refresh and try again.') })
    return () => { active = false }
  }, [user])
  const { values, errors, setValue, onBlur, validate } = useLobbyForm(
    { displayName: '', location: 'Erie, PA', dateTime: initialDinnerTime(), distance: '5', rating: '4.0' },
    {
      displayName: value => user ? undefined : validateDisplayName(value),
      location: validateLocation,
      dateTime: validateDateTime,
      distance: value => distanceOptions.some(option => option === value) ? undefined : 'Choose a distance.',
      rating: value => ratingOptions.some(option => option === value) ? undefined : 'Choose a minimum rating.',
    },
  )
  const [cuisines, setCuisines] = useState<string[]>([])
  const [prices, setPrices] = useState<string[]>([])
  const [diningNeeds, setDiningNeeds] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitPending = useRef(false)
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitPending.current) return
    if (!validate(event.currentTarget)) {
      setStatus('Check the highlighted fields before continuing.')
      return
    }

    if (collectionId && (!user || !collections.some(collection => collection._id === collectionId))) {
      setStatus('Select one of your available collections before continuing.')
      return
    }
    if (groupId && user && (groupLoading || !selectedGroup)) {
      setStatus(groupLoading ? 'Wait for your saved group to load.' : 'Retry loading your group, or continue without a saved group.')
      return
    }
    submitPending.current = true
    setIsSubmitting(true)
    setStatus('Saving lobby…')
    try {
      const result = await lobbyRequest<{ lobby?: { id?: string; lobbyCode?: string; name?: string } }>('/api/lobbies', 'POST', {
          ...(!user ? { displayName: values.displayName.trim() } : {}),
          ...(collectionId ? { collectionId } : {}),
          location: values.location.trim(),
          dinnerAt: new Date(values.dateTime).toISOString(),
          maxDistance: Number(values.distance),
          minimumRating: values.rating === 'any' ? 0 : Number(values.rating),
          categories: cuisines,
          priceLevels: prices,
          diningNeeds,
      })

      if (!result.lobby?.id) throw new Error('The server did not return a lobby ID.')
      let lobbyNotice = 'Lobby created successfully. Share the code to bring your crew together.'
      if (groupId && user && selectedGroup?.members.length) {
        try {
          const { invited } = await inviteSavedGroup(groupId, result.lobby.id)
          lobbyNotice = invited
            ? `Lobby created successfully. Invitations sent for ${invited} saved ${invited === 1 ? 'member' : 'members'} of ${selectedGroup.name}. They choose whether to join.`
            : 'Lobby created successfully. No invitations were needed; the saved members are already here.'
        } catch {
          navigate(generatePath(paths.lobby, { lobbyId: result.lobby.id }), { state: { lobbyNotice: 'Lobby created successfully.', invitationGroupId: groupId, invitationError: `Lobby created, but invitations for ${selectedGroup.name} could not be sent. Use “Invite to this lobby” below to retry.` } })
          return
        }
      } else if (selectedGroup && !selectedGroup.members.length) {
        lobbyNotice = 'Lobby created successfully. Your saved group has no other saved members, so no invitations were sent. Share the lobby code instead.'
      }
      navigate(generatePath(paths.lobby, { lobbyId: result.lobby.id }), { state: { lobbyNotice } })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not create the lobby. Please try again.')
    } finally {
      submitPending.current = false
      setIsSubmitting(false)
    }
  }

  const summary = [
    ...(selectedGroup ? [`Group: ${selectedGroup.name} · ${selectedGroup.members.length} saved members`] : []),
    ...(collectionId ? [`Collection: ${collections.find(collection => collection._id === collectionId)?.name ?? 'Loading…'}`] : []),
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
      {groupId && <section className="create-lobby__group" aria-label="Selected saved group">
        {loading || groupLoading ? <p role="status">Loading your saved group…</p> : !user ? <p>You can create this lobby as a guest. Saved group invitations require the account that saved the group.</p> : groupError ? <p role="alert">{groupError}</p> : selectedGroup && <>
          <strong>Starting with {selectedGroup.name}</strong>
          <p>{selectedGroup.members.length ? `${selectedGroup.members.length} saved ${selectedGroup.members.length === 1 ? 'member will' : 'members will'} receive an invitation after you create the lobby. Choose your dinner settings below.` : 'This group has no other saved members to invite. Create your lobby and share its code instead.'}</p>
        </>}
        <div className="create-lobby__group-actions">
          {user && groupError && <TextAction onClick={() => { setGroupState({ key: groupKey, loading: true }); setGroupRetry(value => value + 1) }}>Retry loading group</TextAction>}
          <TextAction disabled={isSubmitting} onClick={() => { const next = new URLSearchParams(searchParams); next.delete('group'); setSearchParams(next, { replace: true }); setStatus('') }}>Continue without a saved group</TextAction>
          {!user && !loading && <TextAction to={paths.groups}>Explore Saved Groups</TextAction>}
        </div>
      </section>}
      <form className="create-lobby" noValidate onSubmit={submit} onChange={() => setStatus('')}>
        <div className="create-lobby__filters lobby-panel">
          {user && <div className="create-lobby__collection">
            <SelectField label="Restaurant source" value={collectionId} onChange={event => setCollectionId(event.target.value)}>
              <option value="">Discover restaurants with filters</option>
              {collections.map(collection => <option key={collection._id} value={collection._id} disabled={!collection.placeIds.length}>{collection.name} ({collection.placeIds.length}){!collection.placeIds.length ? ' — empty' : ''}</option>)}
            </SelectField>
            {collectionId && <p className="lobby-form-note">Voting uses a snapshot of this collection. The discovery filters below won’t exclude its restaurants.</p>}
            {collectionError && <p role="alert">{collectionError}</p>}
          </div>}
          <div className="create-lobby__fields">
            {!user && <div className="create-lobby__identity">
              <TextInput label="Display name" name="displayName" required autoComplete="nickname" maxLength={40} placeholder="Your name" hint="The name your dinner crew will see." value={values.displayName} error={errors.displayName} onChange={event => setValue('displayName', event.target.value)} onBlur={() => onBlur('displayName')} />
            </div>}
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

        </div>
        <div className="create-lobby__aside">
          <aside className="create-lobby__summary" aria-labelledby="lobby-summary-heading">
            <h2 id="lobby-summary-heading" className="text-heading-h2">Your lobby</h2>
            <ul>{summary.map((line, index) => <li key={index}><span aria-hidden="true">✓</span><span>{line}</span></li>)}</ul>
          </aside>
          <div className="create-lobby__submit">
            <Button type="submit" disabled={loading || isSubmitting || groupLoading}>
              {isSubmitting ? 'Creating lobby…' : 'Create lobby'}
            </Button>
            <p className="lobby-form-note">You can edit these filters before voting starts.</p>
            <p className="lobby-form-status" role="status">{status}</p>
          </div>
          {!groupId && <GuestGroupsReminder context="create" />}
        </div>
      </form>
    </main>
  )
}
