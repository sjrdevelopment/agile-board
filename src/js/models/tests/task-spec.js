define(
    [
        'backbone',
        'constants',
        'taskModel',
        'taskView'
    ],
    function (
        Backbone,
        constants,
        taskModel,
        TaskView
    ) {
        'use strict';

        var PROPERTIES = constants.task.properties;

        describe('Task model', function() {
           var model;

            describe('On initialize', function() {

                beforeEach(function() {
                    model = new taskModel();
                });

                it('should inherit from Backbone.Model', function() {
                    expect(model instanceof Backbone.Model).toBe(true);
                });

            });

            describe('on syncWithApi', function() {
                var dummyChangedAttributes = {};

                beforeEach(function() {
                    model = new taskModel([], {
                        newModel: true
                    });

                    spyOn(model, 'save');

                    dummyChangedAttributes = {
                        param: 'param value'
                    };

                    model.syncWithApi(dummyChangedAttributes);
                });

                it('should call Backbone model save() function', function() {
                    expect(model.save).toHaveBeenCalled();
                    expect(model.save.calls.argsFor(0)[0]).toEqual(dummyChangedAttributes);
                });
            });

            describe('onNewTaskSaveSuccess', function() {
                var attrs = {};

                beforeEach(function() {
                    attrs[PROPERTIES.priority] = 1;

                    model = new taskModel(attrs, {
                        newModel: true
                    });

                    // We don't need to test the specifics of the view in this suite
                    spyOn(TaskView.prototype, 'initialize').and.callFake(function() {
                        return true;
                    });

                    model.onNewTaskSaveSuccess();
                });

                it('as new model, should invoke new view initialize() function', function() {
                    expect(TaskView.prototype.initialize).toHaveBeenCalled();
                })
            });
        });
    }
);
