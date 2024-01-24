import * as cdk from "aws-cdk-lib";
import * as cdkCore from "aws-cdk-lib/core";

import {Construct} from "constructs";
import * as api from "@aws-cdk/aws-apigatewayv2-alpha";
import {PayloadFormatVersion} from "@aws-cdk/aws-apigatewayv2-alpha";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {HttpLambdaIntegration, HttpUrlIntegration,} from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import {Architecture, Tracing} from "aws-cdk-lib/aws-lambda";
import {RemovalPolicy} from "aws-cdk-lib";


export class RemixCdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        /**
         * You could put cloudfront in front of this if you want. It slows down deploys considerably and adds $, but
         * will marginally reduce latency to static assets the further away the client is from the region.
         */
        const bucket = new s3.Bucket(this, 'remix-static-assets-bucket', {
            websiteIndexDocument: "index.html",
            websiteErrorDocument: "404.html",
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: { // equivalent to step 1: https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteAccessPermissionsReqd.html
                blockPublicAcls: false,
                blockPublicPolicy: false,
                ignorePublicAcls: false,
                restrictPublicBuckets: false
            },
            publicReadAccess: true, // equivalent to step 2: https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteAccessPermissionsReqd.html#bucket-policy-static-site

        });

        new s3deploy.BucketDeployment(this, "deploy-remix-static-assets", {
            sources: [s3deploy.Source.asset("public")],
            destinationBucket: bucket,
            destinationKeyPrefix: "_static"
        });

        const fn = new nodejs.NodejsFunction(this, 'remix-server', {
            architecture: Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_20_X,
            tracing: Tracing.ACTIVE,
            entry: "build/index.js",
            handler: "handler",
            memorySize: 512,
            logGroup: new logs.LogGroup(
                this, 'fnLogGroup', {
                    retention: RetentionDays.ONE_MONTH
                }
            )
        });
        const httpApi = new api.HttpApi(this, 'remix-api-gateway');
        httpApi.addRoutes({
            path: `/_static/{proxy+}`,
            methods: [api.HttpMethod.GET],
            integration: new HttpUrlIntegration(
                "s3-url-api-integration",
                `${bucket.virtualHostedUrlForObject()}/_static/{proxy}`
            ),
        });

        httpApi.addRoutes({
            path: `/favicon.ico`,
            methods: [api.HttpMethod.GET],
            integration: new HttpUrlIntegration(
                "s3-url-api-integration",
                `${bucket.virtualHostedUrlForObject()}/_static/favicon.ico`
            ),
        });

        httpApi.addRoutes({
            path: "/{proxy+}",
            methods: [api.HttpMethod.ANY],
            integration: new HttpLambdaIntegration("lambda-api-integration", fn, {
                payloadFormatVersion: PayloadFormatVersion.VERSION_2_0,
            }),
        });

        new cdkCore.CfnOutput(this, 'ApiGatewayEndpoint', {
            value: httpApi.apiEndpoint
        })
    }
}