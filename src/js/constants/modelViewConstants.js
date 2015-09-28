define([], function() {
    
    var constants = {
        apiBaseUrl: 'http://localhost:3000',

        storiesCollection: {
            properties: {
                apiUrl: '/v1/stories'
            }
        },

        tasksCollection: {
            properties: {
                apiUrl: '/v1/tasks'
            }
        },

        editStoryModel: {
            properties: {
                storyModel: 'storyModel'
            }
        },

        editTaskModel: {
            properties: {
                taskModel: 'taskModel'
            }
        },

        storyModel: {
            properties: {
                apiUrl: '/v1/stories',
                idAttribute: 'id',
                priority: 'priority',
                isp1: 'isp1',
                isp2: 'isp2',
                isp3: 'isp3'
            }
        },
    };

    return constants;
});