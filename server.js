import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import fs from 'fs';
import { Resend } from 'resend';

dotenv.config();
const app = express();

const TIME_URL = process.env.TIME_URL;

const GOOGLE_CALENDAR_API_URL = process.env.GOOGLE_CALENDER_API_URL;
const GOOGLE_CALENDAR_API_KEY = process.env.GOOGLE_CALENDER_API_KEY;

const RESEND_API_KEY = process.env.RESEND_API_KEY;

const SYNC_FILE='sync_token.json'; // This is where the sync token will be stored

const emailMessage={
    from:'onboarding@resend.dev',
    to:'suyashdeshpande479@gmail.com',
    subject:'Class Schedule Updated',
};

export default emailMessage;

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
        url=`${GOOGLE_CALENDAR_API_URL}?calendarId=nbh5op11on7jgac8hhmm70jvp0%40group.calendar.google.com&singleEvents=true&timeZone=Asia%2FKolkata&key=${GOOGLE_CALENDAR_API_KEY}&syncToken=${syncToken}`;
    }

    try{

        const response=await axios.get(url);

        if(response){
            const data=response.data;
        
            //check if next syncToken is present in the response, if yes, save it to the sync_file
            if(data.nextSyncToken){
                saveSyncToken(data.nextSyncToken);
            }

            return data.items;

        }

    }
    catch(error){
        console.log('Error fetching schedule');
        return null;
    }

};


// This Route manually triggers schedule fetch and send email (optional)
app.get('/fetch-schedule',async(req,res)=>{
    
        const syncToken = getSyncToken();
        const schedule = await getSchedule(syncToken);

        if(schedule){

            if (schedule.length>0){
                
                let message = `This week's schedule is out !!!\n\n`;

                schedule.forEach((lecture) => {
                    message += `Class: ${lecture.summary} on ${new Date(lecture.start.dateTime).toLocaleString()}\n`;
                });
            
                message += `\nCheck the entire schedule at: \n${TIME_URL}.\n\n\n-Suyash`; 

                try{
                    const response=await resend.emails.send({
                        from:emailMessage.from,
                        to:emailMessage.to,
                        subject:emailMessage.subject,
                        text:message,
                    });

                    if(response.data){
                        console.log('Email sent successfully',response.data);
                        res.status(200).json({message:'Email sent successfully',message});
                    }
                    if(response.error){
                        console.log('Schedule fetched successfully but error while sending email',response.error)
                        res.status(500).json({message:'Schedule fetched successfully but error while sending email'});
                    }
                }
                catch(error){
                    console.log('Schedule fetched successfully but error while sending email')
                    res.status(500).json({message:'Schedule fetched successfully but error while sending email'});
                }

            }
            else{
                const currentDate = new Date();
                const formattedDate = `${String(currentDate.getDate()).padStart(2, '0')}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${String(currentDate.getFullYear()).slice(2)}`;
                const formattedTime = `${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}:${String(currentDate.getSeconds()).padStart(2, '0')}`;

                console.log('No change in the schedule as of :',formattedDate,formattedTime);                
                res.status(200).json({message:'No change in the schedule'});
            }

        }
        else{
            res.status(500).json({message:'Error fetching schedule'});
        }

});


const autoFetch=async()=>{

    const syncToken = getSyncToken();
    const schedule = await getSchedule(syncToken);

    if(schedule){

        if (schedule.length>0){
            
            let message = `This week's schedule is out !!!\n\n`;

            schedule.forEach((lecture) => {
                message += `Class: ${lecture.summary} on ${new Date(lecture.start.dateTime).toLocaleString()}\n`;
            });
        
            message += `\nCheck the entire schedule at: \n${TIME_URL}.\n\n\n-Suyash`; 

            try{
                const response=await resend.emails.send({
                    from:emailMessage.from,
                    to:emailMessage.to,
                    subject:emailMessage.subject,
                    text:message,
                });

                if(response.data){
                    console.log('Email sent successfully',response.data);
                }
                if(response.error){
                    console.log('Schedule fetched successfully but error while sending email',response.error)
                }
            }
            catch(error){
                console.log('Schedule fetched successfully but error while sending email')
            }

        }
        else{
            const currentDate = new Date();
            const formattedDate = `${String(currentDate.getDate()).padStart(2, '0')}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${String(currentDate.getFullYear()).slice(2)}`;
            const formattedTime = `${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}:${String(currentDate.getSeconds()).padStart(2, '0')}`;

            console.log('No change in the schedule as of :',formattedDate,formattedTime);                
        }

    }
    else{
        console.log('Error fetching schedule');
    }

}


autoFetch();

setInterval(autoFetch,1000*60*10);

// Start the server
app.listen(3000,()=>{
    console.log("Server is running on render.com");
});


