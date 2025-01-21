require('dotenv').config();
const express=require('express');
const axios=require('axios');
const fs=require('fs');
const {Resend}=require('resend');
const emailMessage = require('./config.js');
const app=express();

const TIME_URL = process.env.TIME_URL;

const GOOGLE_CALENDAR_API_URL = process.env.GOOGLE_CALENDER_API_URL;
const GOOGLE_CALENDAR_API_KEY = process.env.GOOGLE_CALENDER_API_KEY;

const RESEND_API_KEY = process.env.RESEND_API_KEY;

const SYNC_FILE='sync_token.json'; // This is where the sync token will be stored

// Initializing Resend with the API key
const resend = new Resend(RESEND_API_KEY);

// This function is used to get the sync token from the sync_file 
const getSyncToken=()=>{

    if(fs.existsSync(SYNC_FILE)){
        const data=JSON.parse(fs.readFileSync(SYNC_FILE));
        return data.syncToken;
    }

    return null;
};

// This function is used to save the sync token to the sync_file
const saveSyncToken=(syncToken)=>{
    fs.writeFileSync(SYNC_FILE,JSON.stringify({syncToken}),'utf-8');
};

// This function is used to send push notification via OneSignal
const sendEmail=async(message)=>{
    
    try{
        const response=await resend.emails.send({
            from:emailMessage.from,
            to:emailMessage.to,
            subject:emailMessage.subject,
            text:message,
        });

        console.log('Email sent successfully',response);
    }
    catch(error){
        console.error('Error sending notification',error);
    }

};

// This function is used to get the schedule using Google Calendar API
const getSchedule=async(syncToken=null)=>{

    const currentDate = new Date();
    const nextWeekDate = new Date(currentDate);
    nextWeekDate.setDate(currentDate.getDate() + 7);  // Add 7 days to current date

    // Format dates to ISO format
    const timeMin = currentDate.toISOString();
    const timeMax = nextWeekDate.toISOString();

    let url = `${GOOGLE_CALENDAR_API_URL}?calendarId=nbh5op11on7jgac8hhmm70jvp0%40group.calendar.google.com&singleEvents=true&timeZone=Asia%2FKolkata&key=${GOOGLE_CALENDAR_API_KEY}&timeMin=${timeMin}&timeMax=${timeMax}`;

    if(syncToken){
        url+=`&syncToken=${syncToken}`;
    }

    try{

        const response=await axios.get(url);
        const data=response.data;
        
        //check if next syncToken is present in the response, if yes, save it to the sync_file
        if(data.nextSyncToken){
            saveSyncToken(data.nextSyncToken);
        }

        return data.items;

    }
    catch(error){
        console.error('Error fetching schedule',error);
        return [];
    }

};


// Route to manually trigger schedule fetch (optional)
app.get('/fetch-schedule', async (req, res) => {
    
    try {
        const syncToken = getSyncToken();
        const schedule = await getSchedule(syncToken);

        if (schedule.length > 0) {
            const message = `Class schedule updated!\nYour next class is: ${schedule[0].summary} on ${new Date(schedule[0].start.dateTime).toLocaleString()}\nCheck the entire schedule at: {${TIME_URL}}.`;

            try {
                await sendEmail(message);
            }
            catch (emailError) {
                console.error('Failed to send email:', emailError);
                res.status(200).json({
                    message: 'Fetched schedule successfully, but failed to send email',
                    error: emailError.message,
                    schedule,
                });
                return; 
            }

            res.status(200).json({ message: 'fetched and mailed successfully', schedule });
        } 
        else {
            res.status(200).json({ message: 'No new classes scheduled' });
        }
    } 
    catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ message: 'Error fetching schedule', error: error.message });
    }
});


// Start the server
app.listen(3000,()=>{
    console.log("Server is running on http://localhost:3000");
});


// set interval function to check schedule every day
setInterval(async()=>{

    const syncToken=getSyncToken();
    const schedule=await getSchedule(syncToken);

    if(schedule.length>0){
        
        res.status(200).json({message:'Fetched schedule successfully',schedule});

        const message=`\n Your next class is : ${schedule[0].summary} on ${new Date(schedule[0].start.dateTime).toLocaleString()}\n Check the entire schedule at : {${TIME_URL}}.`;
        await sendEmail(message);
    
    }
    else{
        res.status(404).json({message:'No new classes scheduled'});
    }

},24*60*60*1000); // 24 hours interval



