define(
    [
        'backbone',
        'editTaskModel',
        'tasksCollection',
        'taskModel'
    ],
    function (
        Backbone,
        EditTaskModel,
        TasksCollection,
        TaskModel
    ) {
        'use strict';

        describe('Edit task model', function() {
            var model,
                mockTaskModel,
                mockTasksCollection;

            beforeEach(function() {
                mockTasksCollection = new TasksCollection();

                mockTaskModel = new TaskModel();

                model = new EditTaskModel({
                        taskModel: mockTaskModel
                    },{
                        tasksCollection: mockTasksCollection
                    }
                );
            });

            describe('On initialize', function() {

                it('should inherit from Backbone.Model', function() {
                    expect(model instanceof Backbone.Model).toBe(true);
                });

                it('should have set local property for tasksCollection', function() {
                    expect(model.tasksCollection).toEqual(mockTasksCollection);
                });
            });

            describe('On updateTaskModel', function() {

                beforeEach(function() {
                    spyOn(mockTaskModel, 'syncWithApi');
                    spyOn(mockTasksCollection, 'add');

                    model.updateTaskModel();
                });

                it('should call passed story model syncWithApi function', function() {
                    expect(mockTaskModel.syncWithApi).toHaveBeenCalled();
                });

                it('should invoke tasks collection add with this story model', function() {
                    expect(mockTasksCollection.add).toHaveBeenCalledWith(mockTaskModel);
                });
            });
        });
    }
);
