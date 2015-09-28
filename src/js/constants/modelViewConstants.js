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
                overlay: '.overlay',
                board: '.board',
                addStoryButton: '.add-story-button'
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

            story: {
                properties: {
                    apiUrl: '/v1/stories',
                    idAttribute: 'id',
                    priority: 'priority',
                    isp1: 'isp1',
                    isp2: 'isp2',
                    isp3: 'isp3',
                    persona: 'persona',
                    feature: 'feature'
                },
                cssClasses: {
                    storyRow: 'story-row'
                }
            },

            task: {
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
                    storyID: 'story_id',
                    description: 'description'
                },
                cssClasses: {
                    taskCard: 'task-card'
                }
            }
        };
    }
);