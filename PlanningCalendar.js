/**
 *
 * PlanningCalendar
 *
 */

import { Image, Text, View } from 'react-native';
import React, { memo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import produce from 'immer';
import { Calendar, momentLocalizer } from 'react-native-big-calendar';
import withDragAndDrop from 'react-native-big-calendar/lib/addons/dragAndDrop';
import { useIntl } from 'react-intl';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { createStructuredSelector } from 'reselect';
import { useTheme } from 'styled-components';
import { makeSelectLocale } from 'containers/LanguageProvider/selectors';
import { makeSelectPlannerSetting } from './selectors';
import { makeSelectCurrentUser } from 'containers/User/selectors';
import moment from 'moment';
import { lightenDarkenColor, mixWithWhite } from 'utils/colorTools';
import { API_URL } from 'utils/constants';
import request from 'utils/request';

import messages from './messages';
import Toolbar from './Toolbar';
import EventDetailModal from './EventDetails'

import { useInjectReducer } from 'utils/injectReducer';
import reducer from './reducer';


const DnDCalendar = withDragAndDrop(Calendar);

function PlanningCalendar({ locale, user, plannersetting, ...props }) {
  const theme = useTheme();
  const intl = useIntl();
  useInjectReducer({ key: 'plannersetting', reducer });
 
  
  const localizer = momentLocalizer(moment);
  const [eventDetailVisible, setEventDetailVisible] = useState(false);
  const [currentEvent, setCurrentEvent] = useState();
  const [clerks,setClerks]= useState([]);

  const [events, setEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);


  const ClerkData = new Promise(function(resolve, reject) {  
    request(`${API_URL}/api/clerks`).
    then(response => {
      resolve(response);
    });
  }); 

  
  const EventData = new Promise(function(resolve, reject) {  
    request(`${API_URL}/api/planner/events`).
    then(response => {

      var obj = response.map((data,index) => {
        data.start = new Date(data.start),
        data.end = new Date(data.end)
        return data;
      });
      resolve(obj);
    });
  }); 

 // fill in field data from initialValues
 useEffect(() => {
  //Fetch data from API
  Promise.all([ClerkData, EventData]).then(function(values) {
   
    setClerks(values[0]);
    setAllEvents(values[1]);

       //display event data of clerks having same position of current 
       let eventData = values[1];
    
       eventData = values[1].filter(function (value)
       {
         const show = values[0].find(r=> parseInt(r.id) === parseInt(value.clerkId) 
         && r.position === user.positions);
         return (show !== undefined);
        
       });
       setEvents(eventData);

  });  
}, []);




// called when palnner setting data changes
useEffect(() => {
  if (allEvents.length >0 )
  {
      let eventsData = allEvents;
      //If any record with isShow flag true planner setting store then display filtered records
      if (plannersetting && plannersetting.length > 0) 
      {
        var plannerSettingWithShowFlag = plannersetting.filter(r=> r.isShow === true) 
        if (plannerSettingWithShowFlag && plannerSettingWithShowFlag.length>0)
        {
          eventsData = allEvents.filter(function (value)
          { 
            var show = plannersetting.find(r=> parseInt(r.userId) === parseInt(value.clerkId) && r.isShow);
            return (show !== undefined);
          });
        }
      }
      setEvents(eventsData);
  }

}, [plannersetting]);

  const components = {
    toolbar: Toolbar,
  };

  // Intl Messages
  const calendarMessages = {
    date: intl.formatMessage(messages.date),
    time: intl.formatMessage(messages.time),
    event: intl.formatMessage(messages.event),
    allDay: intl.formatMessage(messages.allDay),
    week: intl.formatMessage(messages.week),
    work_week: intl.formatMessage(messages.work_week),
    day: intl.formatMessage(messages.day),
    month: intl.formatMessage(messages.month),
    previous: intl.formatMessage(messages.previous),
    next: intl.formatMessage(messages.next),
    yesterday: intl.formatMessage(messages.yesterday),
    tomorrow: intl.formatMessage(messages.tomorrow),
    today: intl.formatMessage(messages.today),
    agenda: intl.formatMessage(messages.agenda),
    showMore: count => intl.formatMessage(messages.showMore, { count }),
    noEventsInRange: intl.formatMessage(messages.noEventsInRange),
  };

  function onEventResize({ event, start, end, allDay }) {
    setEvents(
      produce(events, draft => {
        const idx = events.findIndex(e => e.id === event.id);
        // draft[idx].start = start;
        draft[idx].end = end;
      }),
    );
  }

  function onEventDrop({ event, start, end, isAllDay: droppedOnAllDaySlot }) {
    let { allDay } = event;

    if (!event.allDay && droppedOnAllDaySlot) {
      allDay = true;
    } else if (event.allDay && !droppedOnAllDaySlot) {
      allDay = false;
    }

    const idx = events.indexOf(event);

    setEvents(
      produce(events, draft => {
        draft[idx].start = start;
        draft[idx].end = end;
        draft[idx].allDay = allDay;
      }),
    );
    // if (moment(start).dayOfYear() !== moment(end).dayOfYear()) {
    //   start = moment(start).add(-30, 'minutes').toDate();
    //   end = moment(end).add(-30, 'minutes').toDate();
    // }
  }

  function onSelectSlot(event) {
    if (moment(event.start).dayOfYear() !== moment(event.end).dayOfYear()) {
      event.end = moment(event.end)
        .add(1, 'day')
        .toDate();
    }

    if (event.action === 'click') {
      event.end = moment(event.start)
        .add(1, 'hour')
        .toDate();
    }

    console.log(event);
    setEvents(
      produce(events, draft => {
        // title from modal and id from server
        draft.push({ start: event.start, end: event.end, title: 'unnamed' });
      }),
    );
  }

  function onSelectEvent(event) {
    
    console.log(event);
    setCurrentEvent(event);
    //message.info(`You clicked on event ${event.title}`);
    setEventDetailVisible(!eventDetailVisible);
    
  }

  function getEventColorForClerk(clerkId) {
    let color = theme.colors.primary; // Default color
    function numHex(s) {
      let a = Number(s).toString(16);
      if (a.length % 2 > 0) {
        a = `0${a}`;
      }
      return a;
    }

    if (plannersetting && plannersetting.length > 0) {
      const selectColor = plannersetting.filter(
        r => r.userId === parseInt(clerkId),
      );
      if (selectColor && selectColor.length > 0) {
        color = `#${numHex(selectColor[0].color.r)}${numHex(
          selectColor[0].color.g,
        )}${numHex(selectColor[0].color.b)}`;
      }
    }
    return color;
  }

  return (
    <>
    <DnDCalendar
      events={events}
      views={['month', 'week', 'day']}
      defaultView="week"
      messages={calendarMessages}
      localizer={localizer}
      showMultiDayTimes
      resizable
      selectable
      step={60}
      defaultDate={new Date()}
      onEventDrop={onEventDrop}
      onEventResize={onEventResize}
      onSelectSlot={onSelectSlot}
      onSelectEvent={onSelectEvent}
      components={components}
      {...props}
    />
    <EventDetailModal currentEvent={currentEvent} visible={eventDetailVisible} onCancel={() => setEventDetailVisible(false)} />
    </>
  );
}

PlanningCalendar.propTypes = {
  locale: PropTypes.string.isRequired,
};

const mapStateToProps = createStructuredSelector({
  locale: makeSelectLocale(),
  user: makeSelectCurrentUser(),
  plannersetting: makeSelectPlannerSetting(),
});

const withConnect = connect(mapStateToProps);

export default compose(
  withConnect,
  memo,
)(PlanningCalendar);
