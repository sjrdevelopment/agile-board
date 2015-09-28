define(
    function() {
        'use strict';

        return {
            apiBaseUrl: 'http://localhost:3000',

            genericClasses: {
                overlayActive: 'overlay-active',
                overlayContent: 'overlay-content'
            },

            genericEvents: {
                closeOverlay: 'click.closeOverlay'
            },

            genericSelectors: {
                overlay: '.overlay'
            },

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

            taskModel: {
                properties: {
                    apiUrl: '/v1/tasks',
                    idAttribute: 'id',
                    priority: 'priority',
                    status: 'status',
                    isp1: 'isp1',
                    isp2: 'isp2',
                    isp3: 'isp3',
                    isToDo: 'isToDo',
                    isInProgress: 'isInProgress',
                    isDone: 'isDone',
                    storyID: 'story_id'
                }
            },

            editStoryView: {
                cssClasses: {
                    overlayContent: 'overlay-content'
                }
            }
        };
    }
);