import { createContext, useState, useEffect, useContext } from 'react';
import { eventService } from '../services/eventService';

const EventContext = createContext();

export function EventProvider({ children }) {
  const [activeEvent, setActiveEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await eventService.getAllEvents();
      setEvents(data);
      // Auto-select the active or first event
      if (data.length > 0) {
        const savedEventId = localStorage.getItem('activeEventId');
        let active = null;
        
        if (savedEventId) {
          active = data.find(e => e.id === savedEventId);
        }
        
        if (!active) {
          active = data.find(e => e.status === 'active') || data[0];
        }
        
        setActiveEvent(active);
      }
    } catch (error) {
      console.error("Gagal memuat acara:", error);
    } finally {
      setLoading(false);
    }
  };

  const changeActiveEvent = (event) => {
    setActiveEvent(event);
    if (event && event.id) {
      localStorage.setItem('activeEventId', event.id);
    } else {
      localStorage.removeItem('activeEventId');
    }
  };

  return (
    <EventContext.Provider value={{ activeEvent, events, loading, changeActiveEvent, reloadEvents: loadEvents }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  return useContext(EventContext);
}
