const mqtt = require('mqtt');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// MQTT configuration
const mqttConfig = {
    host: process.env.MQTT_HOST,
    port: process.env.MQTT_PORT,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
};

const carId = process.env.CAR_ID || '1';
const topics = [
    `teslamate/cars/${carId}/location`,
    `teslamate/cars/${carId}/state`,
    `teslamate/cars/${carId}/speed`
];

// Connect to MQTT broker
const client = mqtt.connect(`mqtt://${mqttConfig.host}:${mqttConfig.port}`, {
    username: mqttConfig.username,
    password: mqttConfig.password
});

async function updateSetting(key, value) {
    const { error } = await supabase
        .from('settings')
        .upsert(
            { key, value: String(value) },
            { 
                onConflict: 'key',
                returning: true 
            }
        );

    if (error) {
        console.error(`Error updating ${key}:`, error);
        return false;
    }
    
    console.log(`${key} updated successfully to: ${value}`);
    return true;
}

client.on('connect', () => {
    console.log('Connected to MQTT broker');
    topics.forEach(topic => {
        client.subscribe(topic, (err) => {
            if (err) {
                console.error(`Subscription error for ${topic}:`, err);
                return;
            }
            console.log(`Subscribed to ${topic}`);
        });
    });
});

client.on('message', async (topic, message) => {
    try {
        const messageData = message.toString();

        if (topic.endsWith('/location')) {
            // Handle location update
            const locationData = JSON.parse(messageData);
            
            const { error: locationError } = await supabase
                .from('santa_locations')
                .insert([
                    {
                        latitude: locationData.latitude,
                        longitude: locationData.longitude,
                    }
                ]);

            if (locationError) {
                console.error('Error inserting location:', locationError);
                return;
            }

            console.log('Location saved successfully');
        } 
        else if (topic.endsWith('/state')) {
            await updateSetting('state', messageData);
        }
        else if (topic.endsWith('/speed')) {
            await updateSetting('speed', messageData);
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
});

client.on('error', (error) => {
    console.error('MQTT error:', error);
});

// Handle process termination
process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Cleaning up...');
    client.end();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT. Cleaning up...');
    client.end();
    process.exit(0);
});
