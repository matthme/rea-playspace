import { SlButton, SlButtonGroup, SlCheckbox, SlDivider, SlIcon, SlIconButton, SlTooltip } from "@shoelace-style/shoelace/dist/react/index";
import React, { useEffect, useState, useRef } from 'react';
import { Pathed, PathFunctor } from 'data-providers';
import {
  Action,
  ActionKey,
  isTransfer,
  Unit,
  CommitmentShape,
  Commitment,
  EconomicEventShape,
  EconomicEvent,
  EconomicResource,
  Flow
} from 'valueflows-models';
import CommitmentInput from '../input/Commitment';
import EventInput from '../input/Event';
import {
  flowDefaults,
  getEventDefaultsFromCommitment,
  getEventDefaultsFromEvent,
  getCommitmentAndEvents,
  getDisplayNodeBy,
  getLabelForFlow,
  getConformingResource,
  getProvider,
  getReceiver,
  getResource
} from '../../logic/flows';
import { getDataStore } from '../../data/DataStore';
import { objectsDiff } from 'typed-object-tweezers';


/**
 * XXX: This is a mess we really need to break each component out into its own
 * file (Commitment, Event, EconomicResource) with all the handlers packaged in
 * handler files. We could start passing a store object around instead of passing
 * all the props down. Additionally, this could use a state machine, just like
 * FlowCanvas. -JB
 */

interface Props {
  vfPath?: string[];
  source: string;
  target: string;
  planId: string,
  closeModal: () => void;
  afterward?: (items: Pathed<Flow>[]) => void;
}

const FlowModal: React.FC<Props> = ({vfPath, source, target, planId, closeModal, afterward}) => {

  const [actions, setActions] = useState<Array<Pathed<Action>>>([]);
  const [units, setUnits] = useState<Array<Pathed<Unit>>>([]);

  // React ref to the underlying checkbox in the UI
  const commitmentFinishedRef = useRef(null);

  // do we have any side bar panels open?
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);

  // The initial flow shape used to initialize the first commitment
  const [initial, setInitial] = useState<Flow>();

  // The current state of the data, cloned because we merge changes into this before saving
  const [editCommitment, setEditCommitment] = useState<Pathed<Commitment>>(null);
  const [editEvents, setEditEvents] = useState<Array<Pathed<EconomicEvent>>>([]);
  const [editResource, setEditResource] = useState<Pathed<EconomicResource>>(null);

  // The current form data until saving or discarding,
  // saving overwrites the corresponding edit* object.
  const [workingCommitment, setWorkingCommitment] = useState<CommitmentShape>(null);
  const [workingEvent, setWorkingEvent] = useState<EconomicEventShape>(null);
  const [workingResource, setWorkingResource] = useState<Pathed<EconomicResource>>(null);

  // close the commitment and resource panels
  const resetState = () => {
    setCommitmentOpen(false);
    setEventOpen(false);
    setResourceOpen(false);
    setWorkingCommitment(null);
    setWorkingEvent(null);
    setWorkingResource(null);
  }

  // Set up the initial state
  useEffect(() => {
    resetState();

    const store = getDataStore();

    // Grab vfTypes and vfNodes off the DisplayNodes
    const { vfType: sourceVfType, vfNode: sourceVfNode } = getDisplayNodeBy(source);
    const { vfType: targetVfType, vfNode: targetVfNode } = getDisplayNodeBy(target);
    const initialState = flowDefaults[`${sourceVfType}-${targetVfType}`](planId, sourceVfNode, targetVfNode);
    setInitial(initialState);

    if (vfPath) {
      // This clones the events, just to be sure that we don't edit any of the original values
      const {commitment, events} = getCommitmentAndEvents(vfPath);
      setEditCommitment(commitment);
      setEditEvents(events);
    }

    setActions(store.getActions());
    setUnits(store.getUnits());
    return () => {console.log('flowModal unmount')}
  }, []);

  // === COMMITMENT FORM ===

  /**
   * When the commitment changes, update it.
   *
   * This is passed in as the onChange callback
   */
  const handleCommitmentChange = (e: any) => {
    setWorkingCommitment(new Commitment(e.target.value));
  }

  /**
   * Store the commitment so we can save it later
   */
   const handleCommitmentSubmit = () => {
    const commitment = new Commitment(workingCommitment);
    setEditCommitment(commitment);
    setCommitmentOpen(false);

    // Clean up
    setWorkingCommitment(null);
  };

  /**
   * Form for commitment
   */
  const commitmentForm = () => {
    if (commitmentOpen) {
      let state = {...initial} as CommitmentShape;

      // If moving around the panels, such as creating a new Commitment or
      // EconomicResource, use the working state.
      if (workingCommitment) {
        state = {...initial, ...workingCommitment};
      }

      /**
       * If editing a commitment, merge initial state with exisiting data
       * 
       * XXX: this might not give it a unique ID
       */
      if (editCommitment) {
        state = {...initial, ...editCommitment}
      }

      return <>
        <SlIconButton onClick={resetState} name="chevron-left" label="Cancel. Go Back."></SlIconButton>
        <h4 className='panel-heading'>Commitment</h4>
        <CommitmentInput
          commitmentState={state}
          conformingResource={getConformingResource(state, initial)}
          name='commitment'
          onChange={handleCommitmentChange}
        ></CommitmentInput>
        <SlDivider></SlDivider>
        <SlButtonGroup slot="footer">
          <SlButton onClick={handleCommitmentSubmit} variant="primary">{editCommitment?.id? 'Update' : 'Create'}</SlButton>
          <SlButton onClick={resetState} variant="default">Cancel</SlButton>
        </SlButtonGroup>
      </>;
    } else {
      return <></>;
    }
  };

  // === EVENT FORM ===

  /**
   * When the current event changes, update it.
   *
   * This is passed in as the onChange callback
   */
   const handleEventChange = (e: any) => {
    setWorkingEvent(new EconomicEvent(e.target.value));
  }

  /**
   * Store the event so we can save it later
   * If the event is in the list of events, update it. If it's not, then add it
   */
  const handleEventSubmit = () => {
    setEventOpen(false);
    const wronglyPathedEvent = new EconomicEvent(workingEvent);
    const path = `root.economicEvent.${wronglyPathedEvent.id}`;
    const newEvent = PathFunctor(wronglyPathedEvent, path);
    console.log('newEvent: ', newEvent);
    setEditEvents((prevEvents) => {
      const eventIndex = editEvents.findIndex((event) => newEvent.id === event.id);
      if (eventIndex > -1) {
        const newEvents = [...prevEvents];
        newEvents[eventIndex] = newEvent;
        return newEvents;
      } else {
        const newEvents = [...prevEvents, newEvent];
        return newEvents;
      }
    });

    // Clean up
    setWorkingEvent(null);
    setWorkingEvent(null);
  };

  /**
   * Form for events 
   */
  const eventForm = () => {
    let eventState = {...initial, ...workingEvent};
    const readonlyFields = [];

    function disableFields(flow: Flow) {
      if (
        flow.action && flow.action != null
        && !isTransfer(flow.action as ActionKey)) {
        readonlyFields.unshift('action');
      }
      if (flow.resourceQuantity && flow.resourceQuantity != null) {
        readonlyFields.unshift('resourceQuantityUnit');
      }
      if (flow.effortQuantity && flow.effortQuantity != null) {
        readonlyFields.unshift('effortQuantityUnit');
      }
    }

    /**
     * This should prevent editing certain fields when they are present and
     * copied over from a Commitment.
     */
    if (editCommitment && editCommitment != null) {
      eventState = {...initial, ...getEventDefaultsFromCommitment(editCommitment), ...workingEvent};
      disableFields(editCommitment);
    } else {
      // Do the same with Events.
      if (editEvents.length > 1) {
        const firstEvent = editEvents[0];
        eventState = {...initial, ...getEventDefaultsFromEvent(firstEvent), ...workingEvent};
        disableFields(firstEvent);
      }
    }
    if (eventOpen) {
      return <>
        <SlIconButton onClick={resetState} name="chevron-left" label="Cancel. Go Back."></SlIconButton>
        <h4 className='panel-heading'>Event</h4>
        <EventInput
          eventState={eventState}
          readonlyFields={readonlyFields}
          conformingResource={getConformingResource(eventState, initial)}
          name='event'
          onChange={handleEventChange}
        ></EventInput>
        <SlDivider></SlDivider>
        <SlButtonGroup slot="footer">
          <SlButton onClick={handleEventSubmit} variant="primary">{eventState?.id? 'Update' : 'Create'}</SlButton>
          <SlButton onClick={resetState} variant="default">Cancel</SlButton>
        </SlButtonGroup>
      </>;
    } else {
      return <></>;
    }
  };

  // === TOP LEVEL MODAL INNARDS ===

  // This modifies the editCommitment directly because this is not in the Commitment form
  const handleCommitmentFinished = () => {
    setEditCommitment((current) => {
      return new Commitment({...current, finished: commitmentFinishedRef.current.checked});
    })
  }

  /**
   * Determines if the event or commitment panel should be open or closed, returns the appropriate class
   */
   const panelState = () => {
    return (commitmentOpen || eventOpen || resourceOpen) ? ' open' : ' close';
  }

  const handleCommitmentOpen = () => setCommitmentOpen(true)

  const handleEventOpen = () => setEventOpen(true);

  /**
   * A component of sorts to either show a button to add a commitment or a button
   * to edit a commitment.
   */
  const commitmentEditOrCreate = () => {
    if (editCommitment) {
      const commitmentClass = ('commitment-button' + (editCommitment.finished ? ' finished' : ''));
      const label = getLabelForFlow(editCommitment, getConformingResource(editCommitment), getProvider(editCommitment), getReceiver(editCommitment), actions, units);
      return <>
        <SlButton className={commitmentClass} variant="default" onClick={handleCommitmentOpen}>{label}</SlButton>
        <span className='commitment-checkbox-space'></span>
        <SlCheckbox disabled={false} checked={editCommitment.finished} className='commitment-checkbox' onSlChange={handleCommitmentFinished} ref={commitmentFinishedRef}></SlCheckbox>
        <SlTooltip content='Click this checkbox to put the commitment into a finished state.'>
          <SlIcon className='commitment-finish-info' name='info-circle'></SlIcon>
        </SlTooltip>
      </>;
    } else {
      return <>
        <SlButton className='commitment-button' variant="primary" onClick={handleCommitmentOpen}>Create Commitment</SlButton>
        <span className='commitment-checkbox-space'></span>
        <SlCheckbox disabled={true} className='commitment-checkbox' onSlChange={handleCommitmentFinished} ref={commitmentFinishedRef}></SlCheckbox>
        <SlTooltip content='Click this checkbox to put the commitment into a finished state.'>
          <SlIcon className='commitment-finish-info' name='info-circle'></SlIcon>
        </SlTooltip>
      </>;
    }
  };

  // Pick an event to edit, but make a clone so edits don't propagate through the app.
  const pickEvent = (event: EconomicEvent) => {
    setWorkingEvent(event);
  };

  /**
   * Returns an event handler for the button. This is a hack, should use a form-
   * wide event listener and should inspect the key of the object clicked.
   */
  const makeEventClickHandler = (event: EconomicEvent): (()=>void) => {
    return () => {
      pickEvent(event);
      setEventOpen(true);
    }
  };

  /**
   * Pass the array of objects back
   *
   * XXX: maybe it's time to break out the vfPath into vfCommitment and vfEvents
   *      fields?
   * XXX: This always replaces the vfPath array on the edge, which will always
   *      cause a rerender and network traffic on Holochain even if it didn't
   *      change. Might not be a big problem.
   */
  const handleSubmit = () => {
    console.log('on submit')
    closeModal();
    const store = getDataStore();

    // Init array of changed items
    const items: Pathed<Flow>[] = [];

    // Check for the Commitment
    if (
      editCommitment
      && editCommitment !== null
    ) {
      if (editCommitment.path) {
        // If it was changed
        if (objectsDiff(store.getCursor(editCommitment.path), editCommitment)) {
          // Store the object
          const newCommitment: Commitment = store.upsert<Commitment>(editCommitment, Commitment);
          // Ensure it gets passed back to the DisplayEdge
          items.push(newCommitment);
        } else {
          // It hasn't changed, ensure the original gets passed back to the DisplayEdge
          items.push(editCommitment);
        }
      } else {
        // Give the object a path and store it
        const path = `root.plan.${planId}.commitment.${editCommitment.id}`;
        const pathedEditCommitment = PathFunctor(editCommitment, path)
        const newCommitment: Commitment = store.upsert<Commitment>(pathedEditCommitment, Commitment);
        // Ensure it gets passed back to the DisplayEdge
        items.push(newCommitment);
      }
    }

    // Cycle through Events
    for(let event of editEvents) {
      // Check for the Event
      if (event && event !== null) {
        console.log('have an event')
        // If we have a new inventoried resource, let's save it
        if (event.newInventoriedResource) {
          console.log(event.newInventoriedResource);
          const res = new EconomicResource(event.newInventoriedResource);
          const pr = PathFunctor(res, `root.economicResource.${res.id}`);
          const newInventoriedResource = store.upsert<EconomicResource>(pr, EconomicResource);
          // need to figure out which field we're putting the new object on from action.createResource
          const action = actions.find((act) => act.id === event.action);
          if (action.createResource === 'optional') {
            event.resourceInventoriedAs = newInventoriedResource.id;
          } else if (action.createResource === 'optionalTo') {
            event.toResourceInventoriedAs = newInventoriedResource.id;
          }
          delete event.newInventoriedResource;
        }

        if (event.path) {
          console.log(`have path ${event.path}`)
          // If it was changed
          if (objectsDiff(store.getCursor(event.path), event)) {
            console.log('diff');
            const newEvent = store.upsert<EconomicEvent>(event, EconomicEvent);
            // Ensure it gets passed back to the DisplayEdge
            items.push(newEvent);
          } else {
            // It hasn't changed, ensure the original gets passed back to the DisplayEdge
            items.push(event);
          }
        } else {
          // Give the object a path and store the object
          const path = `root.economicEvent.${event.id}`
          const pathedEvent = PathFunctor(event, event.path ? event.path : path);
          const newEvent = store.upsert<EconomicEvent>(pathedEvent, EconomicEvent);
          console.log('new event')
          console.log(newEvent)
          // Ensure it gets passed back to the DisplayEdge
          items.push(newEvent);
        }
      }
    }
    console.log(items);
    if (afterward) afterward(items);
  };

  return (
    <>
      <div className="modal-title">Flows</div>
      <SlDivider></SlDivider>
      <div className='panel-container'>
        <div className='panel-slider'>
          <div className='panel'>
            <div>
              <div className='form-heading'>
                <span>Commitment</span>
                <SlTooltip content="Committed resource flow.">
                  <SlIconButton name="info-circle" />
                </SlTooltip>
              </div>
            </div>
            <div className="commitment-with-finish">
              {commitmentEditOrCreate()}
            </div>
            <br />
            <br />
            <div>
              <div className='form-heading'>
                Events
                <SlTooltip content="Actual resource flows, planned or unplanned.">
                  <SlIconButton name="info-circle" />
                </SlTooltip>
              </div>
            </div>
            {editEvents.map((ev) =>
              <SlButton variant="default" id={`edit-${ev.id}`} key={ev.id} onClick={makeEventClickHandler(ev)}>
                {getLabelForFlow(ev, getResource(ev), getProvider(ev), getReceiver(ev), actions, units)}
              </SlButton>
            )}
            <br />
            <SlButton onClick={handleEventOpen} variant="primary">Create Event</SlButton>
            <SlDivider></SlDivider>
            <SlButtonGroup slot="footer">
              <SlButton onClick={handleSubmit} variant="primary">Done</SlButton>
              <SlButton onClick={closeModal} variant="default">Cancel</SlButton>
            </SlButtonGroup>
          </div>
          <div className={`panel slide${panelState()}`}>
            {commitmentForm()}
            {eventForm()}
          </div>
        </div>
      </div>
    </>
  );
};

export default FlowModal;
