const { app, output } = require('@azure/functions');

// Define Cosmos DB Output Binding
const cosmosOutput = output.cosmosDB({
    databaseName: 'EventDB',
    containerName: 'Bookings',
    connection: 'CosmosDBConnection',
    createIfNotExists: false
});

// Define Service Bus Queue Output Binding
const serviceBusOutput = output.serviceBus({
    queueName: 'booking-queue',
    connection: 'ServiceBusConnection'
});

app.http('ProcessRegistration', {
    methods: ['POST'],
    authLevel: 'anonymous',
    extraOutputs: [cosmosOutput, serviceBusOutput],
    handler: async (request, context) => {
        context.log('Processing event registration request...');

        try {
            const body = await request.json();

            // Validate required request payload fields
            if (!body || !body.eventId || !body.userEmail) {
                return {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'Missing required fields: eventId and userEmail' })
                };
            }

            // Construct the booking record
            const bookingRecord = {
                id: body.id || `booking-${Date.now()}`,
                eventId: body.eventId,
                userEmail: body.userEmail,
                userName: body.userName || 'Guest User',
                tickets: body.tickets || 1,
                status: 'Confirmed',
                createdAt: new Date().toISOString()
            };

            // 1. Write record to Cosmos DB container
            context.extraOutputs.set(cosmosOutput, bookingRecord);

            // 2. Send record to Azure Service Bus Queue to trigger Logic App
            context.extraOutputs.set(serviceBusOutput, bookingRecord);

            return {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Registration successful!',
                    bookingId: bookingRecord.id,
                    details: bookingRecord
                })
            };
        } catch (error) {
            context.log(`Error processing registration: ${error.message}`);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Internal Server Error', error: error.message })
            };
        }
    }
});