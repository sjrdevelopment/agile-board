define(
    [
        'backbone',
        'constants',
        'taskModel'
    ],
    function (
        Backbone,
        constants,
        taskModel
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

            xdescribe('on syncWithApi', function() {
                var dummyChangedAttributes = {};

                beforeEach(function() {
                    model = new storyModel([], {
                        newModel: true
                    });

                    spyOn(model, 'save');

                    dummyChangedAttributes = {
                        param: 'param value'
                    }

                    model.syncWithApi(dummyChangedAttributes);
                });

                it('should call Backbone model save() function', function() {


                    expect(model.save).toHaveBeenCalled();
                    expect(model.save.calls.argsFor(0)[0]).toEqual(dummyChangedAttributes);
                });
            });

            xdescribe('onSaveSuccess', function() {
                var attrs = {};

                beforeEach(function() {
                    attrs[PROPERTIES.priority] = 1;

                    model = new storyModel(attrs, {
                        newModel: true
                    });

                    spyOn(model, 'fetch');

                    model.onSaveSuccess();
                });

                it('as new model, should call Backbone fetch() to get further data from api', function() {
                    expect(model.fetch).toHaveBeenCalled();
                })
            });
        });
    }
);
