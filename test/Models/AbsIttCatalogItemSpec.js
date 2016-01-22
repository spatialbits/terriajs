'use strict';

/*global require, fail*/
var Rectangle = require('terriajs-cesium/Source/Core/Rectangle');

var Terria = require('../../lib/Models/Terria');
var AbsIttCatalogItem = require('../../lib/Models/AbsIttCatalogItem');

var sinon = require('sinon');
// var URI = require('urijs');

describe('AbsIttCatalogItem', function() {
    var terria;
    var item;

    beforeEach(function() {
        terria = new Terria({
            baseUrl: './'
        });
        item = new AbsIttCatalogItem(terria);
    });

    // Is this an important feature?
    // it('defaults to having no dataUrl', function() {
    //     item.url = 'http://foo.bar';
    //     expect(item.dataUrl).toBeUndefined();
    //     expect(item.dataUrlType).toBeUndefined();
    // });

    it('uses explicitly-provided dataUrl and dataUrlType', function() {
        item.dataUrl = 'http://foo.com/data';
        item.dataUrlType = 'wfs-complete';
        item.url = 'http://foo.com/somethingElse';
        expect(item.dataUrl).toBe('http://foo.com/data');
        expect(item.dataUrlType).toBe('wfs-complete');
    });

    it('can update from json', function() {
        item.updateFromJson({
            name: 'Name',
            description: 'Description',
            rectangle: [-10, 10, -20, 20],
            url: 'http://foo.bar',
            datasetId: 'foo'
        });
        expect(item.name).toBe('Name');
        expect(item.description).toBe('Description');
        expect(item.rectangle).toEqual(Rectangle.fromDegrees(-10, 10, -20, 20));
        expect(item.type).toBe('abs-itt');
        expect(item.url.indexOf('http://foo.bar')).toBe(0);
        expect(item.datasetId).toBe('foo');
    });

    it('can be round-tripped with serializeToJson and updateFromJson', function() {
        item.updateFromJson({
            name: 'Name',
            description: 'Description',
            rectangle: [-10, 10, -20, 20],
            url: 'http://foo.bar/',
            datasetId: 'foo'
        });
        var json = item.serializeToJson();
        var reconstructed = new AbsIttCatalogItem(terria);
        reconstructed.updateFromJson(json);
        // item.concepts has a circular dependency via its __knockoutSubscribable property,
        // with itself being a subscriber, so it will not equal reconstructed.concepts.
        // So check the arrays are equal, and then remove them before comparing the rest of the item.
        expect(item.concepts.slice(), reconstructed.concepts.slice());
        delete item.concepts;
        delete item._concepts;
        delete reconstructed.concepts;
        delete reconstructed._concepts;
        // for (var i = Object.keys(item).length - 1; i >= 0; i--) {
        //     var k = Object.keys(item)[i];
        //     console.log(k);
        //     expect(reconstructed[k]).toEqual(item[k]);
        // }
        expect(reconstructed).toEqual(item);
    });

    describe('loading', function() {
        var fakeServer;

        beforeEach(function() {
            sinon.xhr.supportsCORS = true; // force Sinon to use XMLHttpRequest even on IE9
            fakeServer = sinon.fakeServer.create();
            fakeServer.autoRespond = true;

            fakeServer.respond(function(request) {
                fail('Unhandled request to URL: ' + request.url);
            });

            fakeServer.respondWith(
                'GET',
                'data/abs_names.json',
                JSON.stringify({
                    AGE: "Age",
                    MEASURE : {
                        "Persons" : "Sex",
                        "85 years and over" : "Age",
                        "*" : "Measure"
                    }
                })
            );

            fakeServer.respondWith(
                'GET',
                'http://abs.example.com/?method=GetDatasetConcepts&datasetid=foo&format=json',
                JSON.stringify({
                    concepts: [
                        "FREQUENCY",
                        "STATE",
                        "AGE",
                        "REGIONTYPE",
                        "REGION"
                    ]
                })
            );

            fakeServer.respondWith(
                'GET',
                'http://abs.example.com/?method=GetCodeListValue&datasetid=foo&concept=AGE&format=json',
                JSON.stringify({
                    codes: [
                        {
                            code: "A02",
                            description: "0-2 years",
                            parentCode: "",
                            parentDescription: ""
                        },
                        {
                            code: "0",
                            description: "0",
                            parentCode: "A02",
                            parentDescription: "0-2 years"
                        },
                        {
                            code: "1",
                            description: "1",
                            parentCode: "A02",
                            parentDescription: "0-2 years"
                        },
                        {
                            code: "2",
                            description: "2",
                            parentCode: "A02",
                            parentDescription: "0-2 years"
                        },
                        {
                            code: "OTHER",
                            description: "Older than 2",
                            parentCode: "",
                            parentDescription: ""
                        }
                    ]
                })
            );

            fakeServer.respondWith(
                'GET',
                'http://abs.example.com/?method=GetCodeListValue&datasetid=foo&concept=REGIONTYPE&format=json',
                JSON.stringify({
                    "codes": [
                        {
                            "code": "AUS",
                            "description": "Australia",
                            "parentCode": "",
                            "parentDescription": ""
                        },
                        {
                            "code": "SA4",
                            "description": "Statistical Area Level 4",
                            "parentCode": "",
                            "parentDescription": ""
                        }
                    ]
                })
            );

            fakeServer.respondWith(
                'GET',
                'data/regionMapping.json',
                JSON.stringify({
                    "regionWmsMap": {
                        "SA4": {
                            "layerName": "region_map:FID_SA4_2011_AUST",
                            "server": "http://geoserver.nationalmap.nicta.com.au/region_map/ows",
                            "regionProp": "SA4_CODE11",
                            "aliases": [
                                "sa4_code_2011",
                                "sa4_code",
                                "sa4"
                            ],
                            "digits": 3,
                            "description": "Statistical Area Level 4",
                            "regionIdsFile": "data/regionids/region_map-FID_SA4_2011_AUST_SA4_CODE11.json"
                        },
                        "AUS": {
                            "layerName": "region_map:FID_AUS_2011_AUST",
                            "server": "http://geoserver.nationalmap.nicta.com.au/region_map/ows",
                            "regionProp": "AUS_CODE",
                            "aliases": [
                                "aus"
                            ],
                            "regionIdsFile": "data/regionids/region_map-FID_AUS_2011_AUST_AUS_CODE.json"
                        }
                    }
                })
            );

            fakeServer.respondWith(
                'GET',
                'http://abs.example.com/?method=GetGenericData&datasetid=foo&and=REGIONTYPE.AUS%2CAGE.A02&or=REGION&format=csv',
                'Time,Value,REGION,Description\n2011,5400000,0,Australia'
            );

            fakeServer.respondWith(
                'GET',
                'http://abs.example.com/?method=GetGenericData&datasetid=foo&and=REGIONTYPE.SA4%2CAGE.A02&or=REGION&format=csv',
                'Time,Value,REGION,Description\n2011,26000,101,Region101\n2011,31000,102,Region102'
            );

            fakeServer.respondWith(
                'GET',
                'data/2011Census_TOT_AUS.csv',
                'AUS,Tot_P_M,Tot_P_F,Tot_P_P\n0,10600000,11000000,21600000'
            );

            fakeServer.respondWith(
                'GET',
                'data/2011Census_TOT_SA4.csv',
                'SA4,Tot_P_M,Tot_P_F,Tot_P_P\n101,104000,104000,208000\n102,150000,160000,310000'
            );


            fakeServer.respondWith(
                'GET',
                'data/regionids/region_map-FID_AUS_2011_AUST_AUS_CODE.json',
                JSON.stringify({
                    "layer": "region_map:FID_AUS_2011_AUST",
                    "property": "AUS_CODE",
                    "values": [0]
                })
            );

            fakeServer.respondWith(
                'GET',
                'data/regionids/region_map-FID_SA4_2011_AUST_SA4_CODE11.json',
                JSON.stringify({
                    "layer": "region_map:FID_SA4_2011_AUST",
                    "property": "SA4_CODE11",
                    "values": [101,102]
                })
            );
        });

        afterEach(function() {
            fakeServer.restore();
            fakeServer.xhr.filters.length = 0;
        });

        it('works', function(done) {
            item.updateFromJson({
                name: 'Name',
                datasetId: 'foo',
                url: 'http://abs.example.com'
            });
            item.load().then(function() {
                return item.dataSource.regionPromise;
            }).then(function(regionDetails) {
                expect(regionDetails).toBeDefined();
                var columnNames = item._dataSource.tableStructure.getColumnNames();
                expect(columnNames.slice(0, 3)).toEqual(["aus", "Year", "0-2 years"]);
                expect(item._concepts[0].activeItems.length).toEqual(1);
                expect(item.displayPercent).toBe(true);
                var percentage = item._dataSource.tableStructure.activeItems[0].values[0];
                expect(percentage).toEqual(25);  // 54 / 216 * 100
            }).otherwise(fail).then(done);
        });

        it('works with filter parameter', function(done) {
            item.updateFromJson({
                name: 'Name',
                datasetId: 'foo',
                url: 'http://abs.example.com',
                filter: ["REGIONTYPE.SA4"]  // Should use SA4 now
            });
            item.load().then(function() {
                return item.dataSource.regionPromise;
            }).then(function(regionDetails) {
                expect(regionDetails).toBeDefined();
                var columnNames = item._dataSource.tableStructure.getColumnNames();
                expect(columnNames.slice(0, 3)).toEqual(["sa4_code_2011", "Year", "0-2 years"]);
                var percentage = item._dataSource.tableStructure.activeItems[0].values[0];
                expect(percentage).toEqual(12.5);  // 26 / 208 * 100
            }).otherwise(fail).then(done);
        });

        it('is less than 2000 characters when serialised to JSON then URLEncoded', function(done) {
            item.updateFromJson({
                name: 'Name',
                description: 'Description',
                url: 'http://abs.example.com/',
                datasetId: 'foo'
            });
            item.load().then(function() {
                var url = encodeURIComponent(JSON.stringify(item.serializeToJson()));
                expect(url.length).toBeLessThan(2000);
            }).otherwise(fail).then(done);
        });

    });

});
